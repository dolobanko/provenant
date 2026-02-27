import { ProvenantClient } from './client';
import { CreateSessionOptions } from './types';
import { _activeSession } from './session-context';

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
  /** Forwarded to every session created by this client. */
  userId?: string;
  /** Forwarded to every session created by this client. */
  agentVersionId?: string;
  /** Forwarded to every session created by this client. */
  environmentId?: string;
  /** Forwarded to every session created by this client. */
  externalId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Instrument an Anthropic or OpenAI client so that every `messages.create` /
 * `chat.completions.create` call is automatically recorded as a Provenant
 * session with USER + ASSISTANT turns, token counts, tool calls, and latency.
 *
 * The returned value is a transparent Proxy — it has the exact same type as
 * the original client, so your existing code needs zero changes.
 *
 * **Multi-turn session stitching** — use `prov.withSession()` to group multiple
 * LLM calls into a single session::
 *
 * ```ts
 * await prov.withSession(agentId, { userId: 'u1' }, async () => {
 *   const r1 = await client.messages.create({ ... }); // turn 1
 *   const r2 = await client.messages.create({ ... }); // turn 2 — same session
 * });
 * ```
 *
 * **Streaming** — streams are consumed transparently; the full response is
 * recorded after the stream completes::
 *
 * ```ts
 * for await (const chunk of await client.messages.create({ ..., stream: true })) {
 *   process.stdout.write(chunk.delta?.text ?? '');
 * }
 * ```
 *
 * Provenant API failures are silently swallowed (.catch(() => {})) so your
 * agent never breaks even when the observability layer is down.
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

  // Session opts forwarded to every create_session call
  const _sessionOpts: Omit<CreateSessionOptions, 'agentId'> = {};
  if (opts.userId) _sessionOpts.userId = opts.userId;
  if (opts.agentVersionId) _sessionOpts.agentVersionId = opts.agentVersionId;
  if (opts.environmentId) _sessionOpts.environmentId = opts.environmentId;
  if (opts.externalId) _sessionOpts.externalId = opts.externalId;

  const c = client as Record<string, unknown>;

  if (c['messages'] !== undefined) {
    return _instrumentAnthropic(client, prov, resolvedId, _sessionOpts);
  }
  if (c['chat'] !== undefined) {
    return _instrumentOpenAI(client, prov, resolvedId, _sessionOpts);
  }

  throw new Error(
    `[provenant] Unsupported client type: ${(client as object).constructor?.name ?? 'unknown'}. ` +
    'Supported: anthropic.Anthropic, openai.OpenAI',
  );
}

// ── Streaming helpers ─────────────────────────────────────────────────────────

function _isAsyncIterable(v: unknown): v is AsyncIterable<unknown> {
  return v != null && typeof (v as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function';
}

/**
 * Wraps an async-iterable stream so:
 * 1. Every chunk is yielded to the caller in real time (true pass-through).
 * 2. After the stream ends, `onDone(text, toolCalls)` is called with the
 *    reconstructed full response for recording.
 */
async function* _wrapAnthropicStream(
  stream: AsyncIterable<unknown>,
  onDone: (text: string, toolCalls: unknown[]) => Promise<void>,
): AsyncGenerator<unknown> {
  const chunks: unknown[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    yield chunk;
  }

  // Reconstruct text and tool calls from event chunks
  let text = '';
  const toolCallMap: Map<string, Record<string, unknown>> = new Map();

  for (const chunk of chunks) {
    const c = chunk as Record<string, unknown>;
    const type = c['type'] as string | undefined;
    if (type === 'content_block_delta') {
      const delta = (c['delta'] ?? {}) as Record<string, unknown>;
      if (delta['type'] === 'text_delta') {
        text += (delta['text'] as string) ?? '';
      } else if (delta['type'] === 'input_json_delta') {
        // partial tool input — accumulate (index tracked externally via content_block_start)
      }
    } else if (type === 'content_block_start') {
      const block = (c['content_block'] ?? {}) as Record<string, unknown>;
      if (block['type'] === 'tool_use') {
        const idx = String(c['index'] ?? toolCallMap.size);
        toolCallMap.set(idx, {
          id: block['id'],
          name: block['name'],
          input: {},
        });
      }
    }
  }

  const toolCalls = Array.from(toolCallMap.values());
  await onDone(text, toolCalls).catch(() => {});
}

async function* _wrapOpenAIStream(
  stream: AsyncIterable<unknown>,
  onDone: (text: string, toolCalls: unknown[]) => Promise<void>,
): AsyncGenerator<unknown> {
  const chunks: unknown[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    yield chunk;
  }

  let text = '';
  const toolCallMap: Map<number, Record<string, unknown>> = new Map();

  for (const chunk of chunks) {
    const c = chunk as Record<string, unknown>;
    const choices = (c['choices'] ?? []) as Array<Record<string, unknown>>;
    if (!choices.length) continue;
    const delta = (choices[0]['delta'] ?? {}) as Record<string, unknown>;

    const content = delta['content'];
    if (typeof content === 'string') text += content;

    const rawTc = (delta['tool_calls'] ?? []) as Array<Record<string, unknown>>;
    for (const tc of rawTc) {
      const idx = tc['index'] as number ?? 0;
      if (!toolCallMap.has(idx)) {
        const fn = (tc['function'] ?? {}) as Record<string, unknown>;
        toolCallMap.set(idx, { id: tc['id'], name: fn['name'], arguments: fn['arguments'] ?? '' });
      } else {
        const existing = toolCallMap.get(idx)!;
        const fn = (tc['function'] ?? {}) as Record<string, unknown>;
        existing['arguments'] = String(existing['arguments'] ?? '') + String(fn['arguments'] ?? '');
      }
    }
  }

  const toolCalls = Array.from(toolCallMap.values());
  await onDone(text, toolCalls).catch(() => {});
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

function _instrumentAnthropic<T extends object>(
  client: T,
  prov: ProvenantClient,
  resolvedId: Promise<string>,
  sessionOpts: Omit<CreateSessionOptions, 'agentId'>,
): T {
  const c = client as Record<string, unknown>;
  const originalMessages = c['messages'] as Record<string, unknown>;

  const patchedCreate = async (...args: unknown[]): Promise<unknown> => {
    const params = (args[0] ?? {}) as Record<string, unknown>;
    const messages = (params['messages'] ?? []) as Array<Record<string, unknown>>;
    const lastUser = [...messages].reverse().find((m) => m['role'] === 'user');

    // ── Session stitching ──────────────────────────────────────────────
    const existingSessionId = _activeSession.getStore();
    const isManaged = existingSessionId !== undefined;
    let sessionId: string | null = existingSessionId ?? null;

    const agentId = await resolvedId.catch(() => null);

    if (!isManaged && agentId) {
      await prov.sessions
        .create({ agentId, ...sessionOpts })
        .then(async (session) => {
          sessionId = session.id;
          // Record tool results first (Anthropic format: user messages with tool_result content)
          const toolResultMsgs = messages.filter(
            (m) =>
              Array.isArray(m['content']) &&
              (m['content'] as unknown[]).some(
                (c: unknown) => (c as Record<string, unknown>)['type'] === 'tool_result',
              ),
          );
          for (const tr of toolResultMsgs) {
            await prov.sessions.addTurn(sessionId!, { role: 'TOOL', content: tr['content'] }).catch(() => {});
          }
          if (lastUser) {
            await prov.sessions.addTurn(sessionId!, {
              role: 'USER',
              content: lastUser['content'] as string,
            });
          }
        })
        .catch(() => {});
    } else if (isManaged && sessionId) {
      // Managed: still record tool results + user turn in this session
      Promise.resolve()
        .then(async () => {
          const toolResultMsgs = messages.filter(
            (m) =>
              Array.isArray(m['content']) &&
              (m['content'] as unknown[]).some(
                (c: unknown) => (c as Record<string, unknown>)['type'] === 'tool_result',
              ),
          );
          for (const tr of toolResultMsgs) {
            await prov.sessions.addTurn(sessionId!, { role: 'TOOL', content: tr['content'] }).catch(() => {});
          }
          if (lastUser) {
            await prov.sessions.addTurn(sessionId!, {
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
      const originalCreate = originalMessages['create'] as (...a: unknown[]) => Promise<unknown>;
      response = await originalCreate.apply(originalMessages, args);
    } catch (err) {
      if (sessionId && !isManaged) prov.sessions.end(sessionId, { status: 'FAILED' }).catch(() => {});
      throw err;
    }

    const latencyMs = Date.now() - t0;

    // ── Streaming response ─────────────────────────────────────────────
    if (_isAsyncIterable(response)) {
      return _wrapAnthropicStream(response, async (text, toolCalls) => {
        if (!sessionId) return;
        await prov.sessions.addTurn(sessionId, {
          role: 'ASSISTANT',
          content: text,
          toolCalls: toolCalls.length ? toolCalls : undefined,
          latencyMs,
        }).catch(() => {});
        if (!isManaged) await prov.sessions.end(sessionId).catch(() => {});
      });
    }

    // ── Normal response ────────────────────────────────────────────────
    if (sessionId) {
      const r = response as Record<string, unknown>;
      const usage = (r['usage'] ?? {}) as Record<string, unknown>;
      const inputTokens = usage['input_tokens'] as number | undefined;
      const outputTokens = usage['output_tokens'] as number | undefined;
      const contentBlocks = (r['content'] ?? []) as Array<Record<string, unknown>>;

      const assistantText = contentBlocks
        .filter((b) => b['type'] === 'text')
        .map((b) => b['text'] as string)
        .join('');

      const toolCallsList = contentBlocks
        .filter((b) => b['type'] === 'tool_use')
        .map((b) => ({ id: b['id'], name: b['name'], input: b['input'] }));

      Promise.resolve()
        .then(() =>
          prov.sessions.addTurn(sessionId!, {
            role: 'ASSISTANT',
            content: assistantText,
            toolCalls: toolCallsList.length ? toolCallsList : undefined,
            latencyMs,
            inputTokens,
            outputTokens,
          }),
        )
        .then(() => { if (!isManaged) return prov.sessions.end(sessionId!); })
        .catch(() => {});
    }

    return response;
  };

  // Proxy `messages` so `create` and `stream` are intercepted
  const patchedMessages = new Proxy(originalMessages, {
    get(target, prop, receiver) {
      if (prop === 'create') return patchedCreate;
      return Reflect.get(target, prop, receiver);
    },
  });

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
  sessionOpts: Omit<CreateSessionOptions, 'agentId'>,
): T {
  const c = client as Record<string, unknown>;
  const originalChat = c['chat'] as Record<string, unknown>;
  const originalCompletions = originalChat['completions'] as Record<string, unknown>;

  const patchedCreate = async (...args: unknown[]): Promise<unknown> => {
    const params = (args[0] ?? {}) as Record<string, unknown>;
    const messages = (params['messages'] ?? []) as Array<Record<string, unknown>>;
    const lastUser = [...messages].reverse().find((m) => m['role'] === 'user');

    // ── Session stitching ──────────────────────────────────────────────
    const existingSessionId = _activeSession.getStore();
    const isManaged = existingSessionId !== undefined;
    let sessionId: string | null = existingSessionId ?? null;

    const agentId = await resolvedId.catch(() => null);

    if (!isManaged && agentId) {
      await prov.sessions
        .create({ agentId, ...sessionOpts })
        .then(async (session) => {
          sessionId = session.id;
          // OpenAI tool results: messages with role === 'tool'
          const toolMsgs = messages.filter((m) => m['role'] === 'tool');
          for (const tr of toolMsgs) {
            await prov.sessions.addTurn(sessionId!, {
              role: 'TOOL',
              content: tr['content'] as string,
            }).catch(() => {});
          }
          if (lastUser) {
            await prov.sessions.addTurn(sessionId!, {
              role: 'USER',
              content: lastUser['content'] as string,
            });
          }
        })
        .catch(() => {});
    } else if (isManaged && sessionId) {
      Promise.resolve()
        .then(async () => {
          const toolMsgs = messages.filter((m) => m['role'] === 'tool');
          for (const tr of toolMsgs) {
            await prov.sessions.addTurn(sessionId!, {
              role: 'TOOL',
              content: tr['content'] as string,
            }).catch(() => {});
          }
          if (lastUser) {
            await prov.sessions.addTurn(sessionId!, {
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
      if (sessionId && !isManaged) prov.sessions.end(sessionId, { status: 'FAILED' }).catch(() => {});
      throw err;
    }

    const latencyMs = Date.now() - t0;

    // ── Streaming response ─────────────────────────────────────────────
    if (_isAsyncIterable(response)) {
      return _wrapOpenAIStream(response, async (text, toolCalls) => {
        if (!sessionId) return;
        await prov.sessions.addTurn(sessionId, {
          role: 'ASSISTANT',
          content: text,
          toolCalls: toolCalls.length ? toolCalls : undefined,
          latencyMs,
        }).catch(() => {});
        if (!isManaged) await prov.sessions.end(sessionId).catch(() => {});
      });
    }

    // ── Normal response ────────────────────────────────────────────────
    if (sessionId) {
      const r = response as Record<string, unknown>;
      const usage = (r['usage'] ?? {}) as Record<string, unknown>;
      const inputTokens = usage['prompt_tokens'] as number | undefined;
      const outputTokens = usage['completion_tokens'] as number | undefined;
      const choices = (r['choices'] ?? []) as Array<Record<string, unknown>>;
      const msg = (choices[0]?.['message'] ?? {}) as Record<string, unknown>;
      const assistantText = (msg['content'] as string | null) ?? '';
      const rawTc = (msg['tool_calls'] ?? []) as Array<Record<string, unknown>>;
      const toolCallsList = rawTc.map((tc) => ({
        id: tc['id'],
        name: (tc['function'] as Record<string, unknown>)['name'],
        arguments: (tc['function'] as Record<string, unknown>)['arguments'],
      }));

      Promise.resolve()
        .then(() =>
          prov.sessions.addTurn(sessionId!, {
            role: 'ASSISTANT',
            content: assistantText,
            toolCalls: toolCallsList.length ? toolCallsList : undefined,
            latencyMs,
            inputTokens,
            outputTokens,
          }),
        )
        .then(() => { if (!isManaged) return prov.sessions.end(sessionId!); })
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
