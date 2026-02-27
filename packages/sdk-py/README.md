# provenant-sdk

Python SDK for [Provenant](https://provenant.dev) AgentOps — the platform for testing, monitoring, and governing AI agents in production.

**Zero external dependencies** — uses Python standard library only (`urllib`, `json`, `threading`).

---

## Installation

```bash
pip install provenant-sdk
```

---

## Quick Start — Auto-instrumentation

The easiest way to integrate. One line wraps your existing Anthropic or OpenAI client and automatically records every LLM call as a Provenant session.

### Anthropic

```python
import anthropic
from provenant_sdk import instrument

client = instrument(
    anthropic.Anthropic(),
    api_key="pk_live_...",          # from Provenant → API Keys
    agent_id="My Support Bot",      # name or UUID — auto-created if new
    base_url="https://api.provenant.dev",
)

# Zero changes below — sessions, turns, tokens recorded automatically
response = client.messages.create(
    model="claude-opus-4-5",
    messages=[{"role": "user", "content": "Hello, how can I help?"}],
    max_tokens=1024,
)
print(response.content[0].text)
```

### OpenAI

```python
import openai
from provenant_sdk import instrument

client = instrument(
    openai.OpenAI(),
    api_key="pk_live_...",
    agent_id="My Support Bot",
    base_url="https://api.provenant.dev",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)
```

Each call to `messages.create` / `chat.completions.create` automatically:
1. Creates a Provenant session
2. Records the USER turn
3. Calls the real LLM
4. Records the ASSISTANT turn (with token counts and latency)
5. Ends the session

**Provenant API failures are never raised** — they are printed to `stderr` only, so your agent keeps working even if observability is down.

---

## `get_or_create_agent`

The `instrument()` function accepts either a UUID or a human-readable name. If you pass a name, the agent is created automatically on first run and reused thereafter:

```python
from provenant_sdk import ProvenantClient

prov = ProvenantClient(base_url="https://api.provenant.dev", api_key="pk_live_...")
agent_id = prov.get_or_create_agent("My Support Bot")
print(agent_id)  # UUID, same value every time for the same name
```

---

## Manual Session Recording

For full control — useful when you manage multi-turn conversations yourself:

```python
from provenant_sdk import ProvenantClient

prov = ProvenantClient(
    base_url="https://api.provenant.dev",
    api_key="pk_live_...",
)

session = prov.create_session(agent_id="<agent-uuid>")

prov.add_turn(session["id"], role="USER", content="Hello")

# ... call your LLM ...

prov.add_turn(
    session["id"],
    role="ASSISTANT",
    content="Hi there! How can I help?",
    latency_ms=312,
    input_tokens=15,
    output_tokens=42,
)

prov.end_session(session["id"])
```

---

## Evals

```python
run = prov.create_eval_run(suite_id="<suite-uuid>", agent_id="<agent-uuid>")
prov.submit_results(run["id"], results=[
    {"caseId": "<case-uuid>", "passed": True, "score": 1.0, "output": "..."},
])
completed = prov.wait_for_completion(run["id"])
print(f"Pass rate: {completed['passRate']:.0%}")
```

---

## API Reference

| Method | Description |
|--------|-------------|
| `instrument(client, *, api_key, agent_id, base_url, timeout)` | Auto-instrument Anthropic or OpenAI client |
| `ProvenantClient(base_url, api_key, timeout)` | Create API client |
| `client.get_or_create_agent(name)` | Return agent ID, creating if absent |
| `client.list_agents()` | List all agents |
| `client.get_agent(agent_id)` | Get agent by ID |
| `client.create_session(agent_id, ...)` | Start a session |
| `client.add_turn(session_id, role, content, ...)` | Add a conversation turn |
| `client.end_session(session_id, status)` | End a session |
| `client.create_eval_run(suite_id, agent_id, ...)` | Start an eval run |
| `client.submit_results(run_id, results)` | Submit eval results |
| `client.wait_for_completion(run_id, ...)` | Poll until run completes |

---

## Limitations

- **Streaming not supported** — `stream=True` responses are not recorded. Use manual session recording instead.
- **Async clients not supported** — `anthropic.AsyncAnthropic` and `openai.AsyncOpenAI` are not yet patched by `instrument()`.
- **Single-turn sessions** — `instrument()` creates one session per `messages.create` call. For multi-turn conversation tracking, use manual session recording.
