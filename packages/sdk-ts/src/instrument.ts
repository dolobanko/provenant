import { ProvenantClient } from './client';

export interface InstrumentOptions {
  /** Provenant API key (pk_live_...) */
  apiKey: string;
  /** Agent UUID or human-readable name. If a name is given, the agent is
   *  created automatically via POST /agents/get-or-create. */
  agentId: string;
  /** Defaults to https://api.provenant.dev */
  baseUrl?: string;
  /** HTTP timeout in ms. Defaults to 10 000. */
  timeout?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Instrument an Anthropic or OpenAI client so that every `messages.create` /
 * `chat.completions.create` call is automatically recorded as a Provenant
 * session with USER + ASSISTANT turns, token counts, and latency.
 *
 * The returned value is a transparent Proxy — it has the exact same type as
 * the original client, so your existing code needs zero changes.
 *
 * @example
 * ```ts
 * import Anthropic from '@anthropic-ai/sdk';
 * import { instrument } from '@provenant/sdk';
 *
 * const client = instrument(new Anthropic(), {
 *   apiKey: 'pk_live_...',
 *   agentId: 'My Support Bot',   // name → auto-created
 *   baseUrl: 'https://api.provenant.dev',
 * });
 *
 * // Zero changes below — everything is recorded automatically
 * const response = await client.messages.create({ ... });
 * ```
 *
 * Provenant API failures are silently swallowed (.catch(() => {})) so your
 * agent never breaks even when the observability layer is down.
 *
 * Note: streaming responses are not yet supported.
 */
export function instrument<T extends object>(client: T, opts: InstrumentOptions): T {
  const prov = new ProvenantClient({
    baseUrl: opts.baseUrl ?? 'https://api.provenant.dev',
    apiKey: opts.apiKey,
    timeout: opts.timeout ?? 10_000,
  });

  // Resolve agent ID once — UUID passthrough or name → get-or-create
  const resolvedId: Promise<string> = UUID_RE.test(opts.agentId)
    ? Promise.resolve(opts.agentId)
    : prov.agents.getOrCreate(opts.agentId).then((a) => a.id);

  const c = client as Record<string, unknown>;

  if (c['messages'] !== undefined) {
    return _instrumentAnthropic(client, prov, resolvedId);
  }
  if (c['chat'] !== undefined) {
    return _instrumentOpenAI(client, prov, resolvedId);
  }

  throw new Error(
    `[provenant] Unsupported client type: ${(client as object).constructor?.name ?? 'unknown'}. ` +
    'Supported: anthropic.Anthropic, openai.OpenAI',
  );
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

function _instrumentAnthropic<T extends object>(
  client: T,
  prov: ProvenantClient,
  resolvedId: Promise<string>,
): T {
  const c = client as Record<string, unknown>;
  const originalMessages = c['messages'] as Record<string, unknown>;

  const patchedCreate = async (...args: unknown[]): Promise<unknown> => {
    const params = (args[0] ?? {}) as Record<string, unknown>;
    const messages = (params['messages'] ?? []) as Array<Record<string, unknown>>;
    const lastUser = [...messages].reverse().find((m) => m['role'] === 'user');

    let sessionId: string | null = null;

    const agentId = await resolvedId.catch(() => null);
    if (agentId) {
      await prov.sessions
        .create({ agentId })
        .then(async (session) => {
          sessionId = session.id;
          if (lastUser) {
            await prov.sessions.addTurn(sessionId, {
              role: 'USER',
              content: lastUser['content'] as string,
            });
          }
        })
        .catch(() => {}); // never block the caller
    }

    const t0 = Date.now();
    let response: unknown;
    try {
      const originalCreate = originalMessages['create'] as (...a: unknown[]) => Promise<unknown>;
      response = await originalCreate.apply(originalMessages, args);
    } catch (err) {
      if (sessionId) prov.sessions.end(sessionId, { status: 'FAILED' }).catch(() => {});
      throw err;
    }

    const latencyMs = Date.now() - t0;

    if (sessionId) {
      const r = response as Record<string, unknown>;
      const usage = (r['usage'] ?? {}) as Record<string, unknown>;
      const inputTokens = (usage['input_tokens'] as number | undefined);
      const outputTokens = (usage['output_tokens'] as number | undefined);
      const contentBlocks = (r['content'] ?? []) as Array<Record<string, unknown>>;
      const assistantText = contentBlocks
        .filter((b) => b['type'] === 'text')
        .map((b) => b['text'] as string)
        .join('');

      Promise.resolve()
        .then(() =>
          prov.sessions.addTurn(sessionId!, {
            role: 'ASSISTANT',
            content: assistantText,
            latencyMs,
            inputTokens,
            outputTokens,
          }),
        )
        .then(() => prov.sessions.end(sessionId!))
        .catch(() => {}); // fire-and-forget
    }

    return response;
  };

  // Proxy `messages` sub-object so `create` is intercepted
  const patchedMessages = new Proxy(originalMessages, {
    get(target, prop, receiver) {
      if (prop === 'create') return patchedCreate;
      return Reflect.get(target, prop, receiver);
    },
  });

  // Proxy the client itself so `messages` returns patchedMessages
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'messages') return patchedMessages;
      return Reflect.get(target, prop, receiver);
    },
  });
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

function _instrumentOpenAI<T extends object>(
  client: T,
  prov: ProvenantClient,
  resolvedId: Promise<string>,
): T {
  const c = client as Record<string, unknown>;
  const originalChat = c['chat'] as Record<string, unknown>;
  const originalCompletions = originalChat['completions'] as Record<string, unknown>;

  const patchedCreate = async (...args: unknown[]): Promise<unknown> => {
    const params = (args[0] ?? {}) as Record<string, unknown>;
    const messages = (params['messages'] ?? []) as Array<Record<string, unknown>>;
    const lastUser = [...messages].reverse().find((m) => m['role'] === 'user');

    let sessionId: string | null = null;

    const agentId = await resolvedId.catch(() => null);
    if (agentId) {
      await prov.sessions
        .create({ agentId })
        .then(async (session) => {
          sessionId = session.id;
          if (lastUser) {
            await prov.sessions.addTurn(sessionId, {
              role: 'USER',
              content: lastUser['content'] as string,
            });
          }
        })
        .catch(() => {});
    }

    const t0 = Date.now();
    let response: unknown;
    try {
      const originalCreate = originalCompletions['create'] as (...a: unknown[]) => Promise<unknown>;
      response = await originalCreate.apply(originalCompletions, args);
    } catch (err) {
      if (sessionId) prov.sessions.end(sessionId, { status: 'FAILED' }).catch(() => {});
      throw err;
    }

    const latencyMs = Date.now() - t0;

    if (sessionId) {
      const r = response as Record<string, unknown>;
      const usage = (r['usage'] ?? {}) as Record<string, unknown>;
      const inputTokens = usage['prompt_tokens'] as number | undefined;
      const outputTokens = usage['completion_tokens'] as number | undefined;
      const choices = (r['choices'] ?? []) as Array<Record<string, unknown>>;
      const msg = (choices[0]?.['message'] ?? {}) as Record<string, unknown>;
      const assistantText = (msg['content'] as string | null) ?? '';

      Promise.resolve()
        .then(() =>
          prov.sessions.addTurn(sessionId!, {
            role: 'ASSISTANT',
            content: assistantText,
            latencyMs,
            inputTokens,
            outputTokens,
          }),
        )
        .then(() => prov.sessions.end(sessionId!))
        .catch(() => {});
    }

    return response;
  };

  // 3-level Proxy: client → chat → completions → create
  const patchedCompletions = new Proxy(originalCompletions, {
    get(target, prop, receiver) {
      if (prop === 'create') return patchedCreate;
      return Reflect.get(target, prop, receiver);
    },
  });

  const patchedChat = new Proxy(originalChat, {
    get(target, prop, receiver) {
      if (prop === 'completions') return patchedCompletions;
      return Reflect.get(target, prop, receiver);
    },
  });

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'chat') return patchedChat;
      return Reflect.get(target, prop, receiver);
    },
  });
}
