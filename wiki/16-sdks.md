# SDKs

Provenant provides official SDKs for **TypeScript/JavaScript** and **Python**. Both SDKs wrap the REST API and handle authentication, retries, and type safety.

---

## TypeScript SDK

### Installation

```bash
npm install @provenant/sdk
# or
pnpm add @provenant/sdk
# or
yarn add @provenant/sdk
```

### Quick start

```typescript
import { ProvenantClient } from '@provenant/sdk';

const client = new ProvenantClient({
  baseUrl: process.env.PROVENANT_URL!,   // e.g. https://api.example.com
  apiKey:  process.env.PROVENANT_API_KEY!,
  timeout: 30_000,   // optional, ms (default: 30000)
});
```

### Sessions

```typescript
// 1. Create a session
const session = await client.sessions.create({
  agentId: 'your-agent-id',
  agentVersionId: 'optional-version-id',
  environmentId: 'optional-env-id',
  externalId: 'your-internal-trace-id',  // optional correlation ID
  metadata: { userId: 'u_123' },
});

// 2. Record turns
await client.sessions.addTurn(session.id, {
  role: 'USER',
  content: userMessage,
  inputTokens: 85,
});

await client.sessions.addTurn(session.id, {
  role: 'ASSISTANT',
  content: agentResponse,
  toolCalls: rawToolCallsFromModel,
  outputTokens: 312,
  latencyMs: 740,
});

// 3. End the session
await client.sessions.end(session.id);
// or: await client.sessions.end(session.id, { status: 'FAILED' });
```

### Agents

```typescript
const agents = await client.agents.list();
const agent  = await client.agents.get('agent-id');

// Shorthand: create a session directly from an agent
const session = await client.agents.createSession('agent-id', {
  environmentId: 'prod',
});
```

### Eval runs

```typescript
// Create an eval run
const run = await client.evals.createRun({
  suiteId: 'suite-uuid',
  agentId: 'agent-uuid',
  agentVersionId: 'version-uuid',
});

// Submit results (if you're running evals externally)
await client.evals.submitResults(run.id, [
  {
    caseId: 'case-uuid',
    actualOutput: 'Agent said: ...',
    score: 92,
    passed: true,
    latencyMs: 640,
    tokenCount: 200,
  },
]);

// Poll until COMPLETED or FAILED
const completed = await client.evals.waitForCompletion(run.id, {
  pollIntervalMs: 2000,   // default
  timeoutMs: 300_000,     // default (5 min)
});

console.log(`Pass rate: ${(completed.passRate * 100).toFixed(1)}%`);
```

### Error handling

```typescript
import { ProvenantClient, HttpError } from '@provenant/sdk';

try {
  await client.sessions.create({ agentId: 'bad-id' });
} catch (err) {
  if (err instanceof HttpError) {
    console.error(`API error ${err.statusCode}: ${err.message}`);
    // err.statusCode: 400, 401, 403, 404, 500, …
  }
}
```

### Full type reference

```typescript
// Key types exported from @provenant/sdk
import type {
  ProvenantConfig,
  Agent,
  Session,
  SessionTurn,
  EvalRun,
  EvalCaseResult,
  CreateSessionOptions,
  AddTurnOptions,
  EndSessionOptions,
  CreateEvalRunOptions,
  SubmitResultOptions,
  WaitForCompletionOptions,
} from '@provenant/sdk';
```

---

## Python SDK

### Installation

```bash
pip install provenant-sdk
# or from source:
pip install -e packages/sdk-py
```

> **No external dependencies** — the Python SDK uses only the standard library (`urllib`, `json`, `time`).

### Quick start

```python
from provenant_sdk import ProvenantClient
import os

client = ProvenantClient(
    base_url=os.environ["PROVENANT_URL"],
    api_key=os.environ["PROVENANT_API_KEY"],
    timeout=30,  # seconds, optional
)
```

### Sessions

```python
# 1. Create a session
session = client.create_session(
    agent_id="your-agent-id",
    agent_version_id="optional-version-id",   # optional
    environment_id="optional-env-id",          # optional
    external_id="your-internal-trace-id",      # optional
    metadata={"user_id": "u_123"},             # optional
)

# 2. Record turns
client.add_turn(
    session["id"],
    role="USER",
    content=user_message,
    input_tokens=85,
)

client.add_turn(
    session["id"],
    role="ASSISTANT",
    content=agent_response,
    tool_calls=raw_tool_calls,   # optional
    output_tokens=312,
    latency_ms=740,
)

# 3. End the session
client.end_session(session["id"])
# or: client.end_session(session["id"], status="FAILED")
```

### Agents

```python
agents = client.list_agents()
agent  = client.get_agent("agent-id")
```

### Eval runs

```python
# Create an eval run
run = client.create_eval_run(
    suite_id="suite-uuid",
    agent_id="agent-uuid",
    agent_version_id="version-uuid",   # optional
)

# Submit results externally
client.submit_results(run["id"], [
    {
        "caseId":       "case-uuid",
        "actualOutput": "Agent said: ...",
        "score":        92,
        "passed":       True,
        "latencyMs":    640,
        "tokenCount":   200,
    }
])

# Poll until COMPLETED or FAILED
completed = client.wait_for_completion(
    run["id"],
    poll_interval_seconds=2.0,
    timeout_seconds=300.0,
)
print(f"Pass rate: {completed['passRate'] * 100:.1f}%")
```

### Error handling

```python
from provenant_sdk import ProvenantClient, ProvenantError

try:
    session = client.create_session(agent_id="bad-id")
except ProvenantError as e:
    print(f"API error {e.status_code}: {e}")
except TimeoutError:
    print("Eval run timed out")
```

---

## Async usage (TypeScript)

The TypeScript SDK uses native `fetch` which is async by default. For use in Node.js < 18, polyfill `fetch` with `node-fetch`:

```bash
npm install node-fetch
```

```typescript
import fetch from 'node-fetch';
(global as any).fetch = fetch;
```

---

## Environment variable patterns

### Node.js / TypeScript

```bash
# .env
PROVENANT_URL=http://localhost:4000
PROVENANT_API_KEY=pk_live_...
```

```typescript
import 'dotenv/config';
import { ProvenantClient } from '@provenant/sdk';

const client = new ProvenantClient({
  baseUrl: process.env.PROVENANT_URL!,
  apiKey:  process.env.PROVENANT_API_KEY!,
});
```

### Python

```bash
# .env
PROVENANT_URL=http://localhost:4000
PROVENANT_API_KEY=pk_live_...
```

```python
from dotenv import load_dotenv
load_dotenv()

import os
from provenant_sdk import ProvenantClient

client = ProvenantClient(
    base_url=os.environ["PROVENANT_URL"],
    api_key=os.environ["PROVENANT_API_KEY"],
)
```

---

## Next steps

- [CI/CD & GitHub Actions](17-ci-cd.md) — gate deployments with eval runs
- [Sessions](09-sessions.md) — full session API reference
- [Evaluations](07-evaluations.md) — building eval suites
