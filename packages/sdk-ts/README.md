# @provenant/sdk

TypeScript/JavaScript SDK for [Provenant](https://provenant.dev) AgentOps — the platform for testing, monitoring, and governing AI agents in production.

**No external dependencies** — works in Node.js 18+ (uses native `fetch` and `AsyncLocalStorage`).

---

## Install

```bash
npm install @provenant/sdk
```

---

## Quick Start — Auto-instrumentation

### Anthropic

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { instrument } from '@provenant/sdk';

const client = instrument(new Anthropic(), {
  apiKey: 'pk_live_...',        // from /api-keys in the dashboard
  agentId: 'My Support Bot',    // name → auto-created; or pass a UUID directly
  baseUrl: 'https://api.provenant.dev',
});

// Zero changes below — sessions, turns, and token counts recorded automatically
const response = await client.messages.create({
  model: 'claude-opus-4-5',
  messages: [{ role: 'user', content: 'Hello!' }],
  max_tokens: 1024,
});
console.log(response.content[0].text);
```

### OpenAI

```typescript
import OpenAI from 'openai';
import { instrument } from '@provenant/sdk';

const client = instrument(new OpenAI(), {
  apiKey: 'pk_live_...',
  agentId: 'My GPT Bot',
  baseUrl: 'https://api.provenant.dev',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.choices[0].message.content);
```

---

## Multi-Turn Session Stitching

By default, each `messages.create` call creates its own isolated session. For agents that make multiple LLM calls in a loop (tool use, multi-turn conversations), use `prov.withSession()` to group them into one session:

```typescript
import { ProvenantClient, instrument } from '@provenant/sdk';

const prov = new ProvenantClient({ baseUrl: 'https://api.provenant.dev', apiKey: 'pk_live_...' });
const client = instrument(new Anthropic(), { apiKey: 'pk_live_...', agentId: '<uuid>', baseUrl: '...' });

await prov.withSession(
  '<agent-uuid>',
  { userId: 'user-123', externalId: 'conversation-abc' },
  async (sessionId) => {
    // Turn 1 — LLM decides to call a tool
    const r1 = await client.messages.create({
      model: 'claude-opus-4-5',
      messages: [{ role: 'user', content: "What's the weather in Paris?" }],
      max_tokens: 512,
    });

    // Turn 2 — send tool result back, get final answer
    const r2 = await client.messages.create({
      model: 'claude-opus-4-5',
      messages: [
        { role: 'user', content: "What's the weather in Paris?" },
        { role: 'assistant', content: r1.content },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: '...', content: '22°C, sunny' }] },
      ],
      max_tokens: 512,
    });
  },
);
// Session ended automatically — dashboard shows one session with 4 turns
```

---

## Tool Calls

Tool calls and tool results are captured automatically — no code changes needed.

When the LLM returns `tool_use` blocks (Anthropic) or `tool_calls` (OpenAI), they appear in the ASSISTANT turn's `toolCalls` field in the dashboard. Tool result messages are recorded as `TOOL` role turns.

```typescript
// Tool call — captured automatically
const response = await client.messages.create({
  model: 'claude-opus-4-5',
  tools: [{ name: 'web_search', description: '...', input_schema: { ... } }],
  messages: [{ role: 'user', content: 'Search for recent AI news' }],
  max_tokens: 1024,
});
// tool_use blocks in response.content → stored in session turn's toolCalls

// Tool result in next call → recorded as TOOL turn automatically
await client.messages.create({
  model: 'claude-opus-4-5',
  messages: [
    { role: 'user', content: 'Search for recent AI news' },
    { role: 'assistant', content: response.content },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_123', content: '...results...' }] },
  ],
  max_tokens: 1024,
});
```

---

## Streaming

Streaming is fully supported. Chunks are yielded to your code in real time; Provenant records the full aggregated response after the stream completes.

```typescript
// Async-iterable streaming (Anthropic / OpenAI with stream: true)
const stream = await client.messages.create({
  model: 'claude-opus-4-5',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  max_tokens: 1024,
  stream: true,
});

for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
    process.stdout.write(chunk.delta.text);
  }
}
// Provenant records after the loop ends
```

---

## Optional Session Parameters

Enrich every session this client creates by passing these to `instrument()`:

```typescript
const client = instrument(new Anthropic(), {
  apiKey: 'pk_live_...',
  agentId: 'Support Bot',
  baseUrl: 'https://api.provenant.dev',
  userId: 'user-456',                // link sessions to a specific user
  agentVersionId: '<version-uuid>',  // which deployed version
  environmentId: '<env-uuid>',       // prod / staging / dev environment
  externalId: 'conv-789',            // your own conversation / thread ID
});
```

---

## Manual Session Recording

For full control without auto-instrumentation:

```typescript
import { ProvenantClient } from '@provenant/sdk';

const prov = new ProvenantClient({ baseUrl: 'https://api.provenant.dev', apiKey: 'pk_live_...' });

const session = await prov.sessions.create({ agentId: '<uuid>', userId: 'u1' });
await prov.sessions.addTurn(session.id, { role: 'USER', content: 'Hello' });
await prov.sessions.addTurn(session.id, { role: 'ASSISTANT', content: 'Hi there!', latencyMs: 342 });
await prov.sessions.end(session.id);
```

---

## get_or_create_agent

Get or create an agent by name — idempotent, safe to call on startup:

```typescript
const prov = new ProvenantClient({ baseUrl: '...', apiKey: 'pk_live_...' });
const agent = await prov.agents.getOrCreate('My Support Bot');
// returns the same agent UUID every time
```

---

## Evals

```typescript
const run = await prov.evals.createRun({ suiteId: '<suite-uuid>', agentId: '<agent-uuid>' });

const results = await Promise.all(
  testCases.map(async (tc) => ({
    caseId: tc.id,
    actualOutput: await yourAgent(tc.input),
    passed: true,
    latencyMs: 120,
  }))
);

await prov.evals.submitResults(run.id, results);
const completed = await prov.evals.waitForCompletion(run.id);
console.log(`Score: ${completed.score}, Pass rate: ${completed.passRate}`);
```

---

## API Reference

| Method | Description |
|--------|-------------|
| `instrument(client, opts)` | One-liner instrumentation for Anthropic / OpenAI clients |
| `new ProvenantClient(config)` | Raw API client |
| `prov.withSession(agentId, opts, fn)` | Group multiple LLM calls into one session |
| `prov.agents.getOrCreate(name)` | Idempotently get or create an agent → returns `Agent` |
| `prov.sessions.create(opts)` | Create a session manually |
| `prov.sessions.addTurn(sessionId, opts)` | Add a turn (`USER` / `ASSISTANT` / `SYSTEM` / `TOOL`) |
| `prov.sessions.end(sessionId, opts?)` | End a session |
| `prov.evals.createRun(opts)` | Start an eval run |
| `prov.evals.submitResults(runId, results)` | Submit eval case results |
| `prov.evals.waitForCompletion(runId, opts?)` | Poll until the eval run finishes |

### `InstrumentOptions`

| Field | Type | Description |
|-------|------|-------------|
| `apiKey` | `string` | Provenant API key (`pk_live_...`) |
| `agentId` | `string` | Agent UUID or human-readable name |
| `baseUrl` | `string?` | API base URL (default: `https://api.provenant.dev`) |
| `timeout` | `number?` | HTTP timeout in ms (default: 10 000) |
| `userId` | `string?` | Forwarded to every session |
| `agentVersionId` | `string?` | Forwarded to every session |
| `environmentId` | `string?` | Forwarded to every session |
| `externalId` | `string?` | Forwarded to every session |

---

## Notes

- Provenant API failures are **never raised** — swallowed with `.catch(() => {})` so your agent keeps running even if the observability layer is down.
- Streaming responses are buffered to completion before recording; individual chunk events are not tracked separately.
- Requires Node.js 18+ for native `fetch` and `AsyncLocalStorage`.
