# @provenant/sdk

TypeScript/JavaScript SDK for [Provenant](https://provenant.dev) AgentOps — the platform for testing, monitoring, and governing AI agents in production.

**No external dependencies** — works in Node.js 18+ (uses native `fetch`).

---

## Installation

```bash
npm install @provenant/sdk
# or
pnpm add @provenant/sdk
```

---

## Quick Start — Auto-instrumentation

One function call wraps your existing Anthropic or OpenAI client and automatically records every LLM call as a Provenant session.

### Anthropic

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { instrument } from '@provenant/sdk';

const client = instrument(new Anthropic(), {
  apiKey: 'pk_live_...',          // from Provenant → API Keys
  agentId: 'My Support Bot',      // name or UUID — auto-created if new
  baseUrl: 'https://api.provenant.dev',
});

// Zero changes below — sessions, turns, tokens recorded automatically
const response = await client.messages.create({
  model: 'claude-opus-4-5',
  messages: [{ role: 'user', content: 'Hello, how can I help?' }],
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
  agentId: 'My Support Bot',
  baseUrl: 'https://api.provenant.dev',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});
console.log(response.choices[0].message.content);
```

The returned value is a transparent **Proxy** — it has the exact same TypeScript type as the original client, so your IDE autocomplete and type checking work without changes.

Each call automatically records: session creation, USER turn, ASSISTANT turn (with token counts + latency), session end.

**Provenant API failures are silently swallowed** (`.catch(() => {})`) — your agent never breaks even if observability is down.

---

## `getOrCreate` — skip the UUID

Pass a human-readable name instead of a UUID to `instrument()`. The agent is created on first run and reused forever:

```typescript
import { ProvenantClient } from '@provenant/sdk';

const prov = new ProvenantClient({
  baseUrl: 'https://api.provenant.dev',
  apiKey: 'pk_live_...',
});

const agent = await prov.agents.getOrCreate('My Support Bot');
console.log(agent.id); // same UUID every time
```

---

## Manual Session Recording

For full control over multi-turn conversations:

```typescript
import { ProvenantClient } from '@provenant/sdk';

const prov = new ProvenantClient({
  baseUrl: 'https://api.provenant.dev',
  apiKey: 'pk_live_...',
});

const session = await prov.sessions.create({ agentId: '<agent-uuid>' });

await prov.sessions.addTurn(session.id, { role: 'USER', content: 'Hello' });

// ... call your LLM ...

await prov.sessions.addTurn(session.id, {
  role: 'ASSISTANT',
  content: 'Hi! How can I help?',
  latencyMs: 312,
  inputTokens: 15,
  outputTokens: 42,
});

await prov.sessions.end(session.id);
```

---

## Evals

```typescript
const run = await prov.evals.createRun({
  suiteId: '<suite-uuid>',
  agentId: '<agent-uuid>',
});

await prov.evals.submitResults(run.id, {
  results: [{ caseId: '<case-uuid>', passed: true, score: 1.0, output: '...' }],
});

const completed = await prov.evals.waitForCompletion(run.id);
console.log(`Pass rate: ${(completed.passRate ?? 0) * 100}%`);
```

---

## API Reference

| Export | Description |
|--------|-------------|
| `instrument(client, opts)` | Auto-instrument Anthropic or OpenAI client |
| `ProvenantClient` | Main API client class |
| `prov.agents.list()` | List all agents |
| `prov.agents.get(id)` | Get agent by ID |
| `prov.agents.create(opts)` | Create a new agent |
| `prov.agents.getOrCreate(name)` | Return agent, creating if absent |
| `prov.sessions.create(opts)` | Start a session |
| `prov.sessions.addTurn(id, turn)` | Add a conversation turn |
| `prov.sessions.end(id, opts)` | End a session |
| `prov.evals.createRun(opts)` | Start an eval run |
| `prov.evals.submitResults(id, results)` | Submit eval results |
| `prov.evals.waitForCompletion(id, opts)` | Poll until run completes |

---

## Limitations

- **Streaming not supported** — `stream: true` responses are not recorded.
- **Single-turn sessions** — `instrument()` creates one session per `messages.create` call. For multi-turn tracking, use `ProvenantClient` directly.
- **Node.js 18+** required for native `fetch`. Use a polyfill for older versions.
