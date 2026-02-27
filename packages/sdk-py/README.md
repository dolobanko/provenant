# provenant-sdk

Python SDK for [Provenant](https://provenant.dev) AgentOps — the platform for testing, monitoring, and governing AI agents in production.

**Zero external dependencies** — uses Python standard library only (`urllib`, `json`, `threading`, `contextvars`).

---

## Install

```bash
pip install provenant-sdk
```

---

## Quick Start — Auto-instrumentation

### Anthropic

```python
import anthropic
from provenant_sdk import instrument

client = instrument(
    anthropic.Anthropic(),
    api_key="pk_live_...",        # from /api-keys in the dashboard
    agent_id="My Support Bot",    # name → auto-created; or pass a UUID directly
    base_url="https://api.provenant.dev",
)

# Zero changes below — sessions, turns, and token counts recorded automatically
response = client.messages.create(
    model="claude-opus-4-5",
    messages=[{"role": "user", "content": "Hello!"}],
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
    agent_id="My GPT Bot",
    base_url="https://api.provenant.dev",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

---

## Multi-Turn Session Stitching

By default, each `messages.create` call creates its own isolated session. For agents that make multiple LLM calls in a loop (tool use, multi-turn conversations), use `prov.session()` to group them into one session with multiple turns:

```python
from provenant_sdk import ProvenantClient, instrument

prov = ProvenantClient(base_url="https://api.provenant.dev", api_key="pk_live_...")
client = instrument(anthropic.Anthropic(), api_key="pk_live_...", agent_id="<uuid>",
                    base_url="https://api.provenant.dev")

with prov.session(
    agent_id="<agent-uuid>",
    user_id="user-123",
    external_id="conversation-abc",   # your own conversation / thread ID
) as session_id:
    # Turn 1 — LLM decides to call a tool
    r1 = client.messages.create(
        model="claude-opus-4-5",
        messages=[{"role": "user", "content": "What's the weather in Paris?"}],
        max_tokens=512,
    )
    # Turn 2 — send tool result back, get final answer
    r2 = client.messages.create(
        model="claude-opus-4-5",
        messages=[
            {"role": "user", "content": "What's the weather in Paris?"},
            {"role": "assistant", "content": r1.content},
            {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "...", "content": "22°C, sunny"}]},
        ],
        max_tokens=512,
    )
# Session ended automatically — dashboard shows one session with 4 turns (USER, ASSISTANT, TOOL, ASSISTANT)
```

---

## Tool Calls

Tool calls and tool results are captured automatically — no code changes needed.

When the LLM returns `tool_use` blocks (Anthropic) or `tool_calls` (OpenAI), they appear in the ASSISTANT turn's `toolCalls` field in the dashboard. When tool results are passed back to the LLM, they are recorded as a `TOOL` role turn.

```python
# Tool call — captured automatically from the response
response = client.messages.create(
    model="claude-opus-4-5",
    tools=[{"name": "web_search", "description": "...", "input_schema": {...}}],
    messages=[{"role": "user", "content": "Search for recent AI news"}],
    max_tokens=1024,
)
# ToolUseBlock in response.content → stored in session turn's toolCalls

# Tool result in next call → recorded as TOOL turn automatically
client.messages.create(
    model="claude-opus-4-5",
    messages=[
        {"role": "user", "content": "Search for recent AI news"},
        {"role": "assistant", "content": response.content},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "toolu_123", "content": "...results..."}
        ]},
    ],
    max_tokens=1024,
)
```

---

## Async Clients

`AsyncAnthropic` and `AsyncOpenAI` are detected and patched automatically:

```python
import asyncio
import anthropic
from provenant_sdk import instrument

async def main():
    client = instrument(
        anthropic.AsyncAnthropic(),
        api_key="pk_live_...",
        agent_id="Async Bot",
        base_url="https://api.provenant.dev",
    )
    response = await client.messages.create(
        model="claude-opus-4-5",
        messages=[{"role": "user", "content": "Hello async!"}],
        max_tokens=512,
    )
    print(response.content[0].text)

asyncio.run(main())
```

---

## Streaming

Streaming is fully supported. Chunks are yielded to your code in real time; Provenant records the full aggregated response after the stream completes.

```python
# stream=True kwarg
for chunk in client.messages.create(
    model="claude-opus-4-5",
    messages=[{"role": "user", "content": "Tell me a story"}],
    max_tokens=1024,
    stream=True,
):
    if chunk.delta.type == "text_delta":
        print(chunk.delta.text, end="", flush=True)

# Context manager style (Anthropic only)
with client.messages.stream(
    model="claude-opus-4-5",
    messages=[{"role": "user", "content": "Tell me a story"}],
    max_tokens=1024,
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
# Provenant records when the context manager exits
```

---

## Optional Session Parameters

Enrich every session this client creates by passing these to `instrument()`:

```python
client = instrument(
    anthropic.Anthropic(),
    api_key="pk_live_...",
    agent_id="Support Bot",
    base_url="https://api.provenant.dev",
    user_id="user-456",                # link sessions to a specific user
    agent_version_id="<version-uuid>", # which deployed version
    environment_id="<env-uuid>",       # prod / staging / dev environment
    external_id="conv-789",            # your own conversation / thread ID
)
```

---

## Manual Session Recording

For full control over session lifecycle without auto-instrumentation:

```python
from provenant_sdk import ProvenantClient

prov = ProvenantClient(base_url="https://api.provenant.dev", api_key="pk_live_...")

session = prov.create_session(agent_id="<agent-uuid>", user_id="u1")
prov.add_turn(session["id"], role="USER", content="Hello")
prov.add_turn(session["id"], role="ASSISTANT", content="Hi there!",
              latency_ms=342, input_tokens=10, output_tokens=8)
prov.end_session(session["id"])
```

---

## get_or_create_agent

Get or create an agent by name — idempotent, safe to call on every startup:

```python
prov = ProvenantClient(base_url="...", api_key="pk_live_...")
agent_id = prov.get_or_create_agent("My Support Bot")
# returns the same UUID every time
```

---

## Evals

```python
run = prov.create_eval_run(suite_id="<suite-uuid>", agent_id="<agent-uuid>")

results = []
for case in your_test_cases:
    output = your_agent(case["input"])
    results.append({
        "caseId": case["id"],
        "actualOutput": output,
        "passed": output == case["expected"],
        "latencyMs": 120,
    })

prov.submit_results(run["id"], results)
completed = prov.wait_for_completion(run["id"])
print(f"Score: {completed['score']}, Pass rate: {completed['passRate']}")
```

---

## API Reference

| Method | Description |
|--------|-------------|
| `instrument(client, *, api_key, agent_id, base_url, timeout, user_id, agent_version_id, environment_id, external_id)` | One-liner instrumentation for Anthropic / OpenAI (sync + async) clients |
| `ProvenantClient(base_url, api_key, timeout)` | Raw API client |
| `prov.session(agent_id, *, user_id, agent_version_id, environment_id, external_id, ...)` | Context manager for multi-turn session stitching |
| `prov.get_or_create_agent(name)` | Idempotently get or create an agent → returns UUID |
| `prov.create_session(agent_id, ...)` | Create a session manually |
| `prov.add_turn(session_id, role, content, ...)` | Add a turn (`USER` / `ASSISTANT` / `SYSTEM` / `TOOL`) |
| `prov.end_session(session_id, status)` | End a session |
| `prov.create_eval_run(suite_id, agent_id, ...)` | Start an eval run |
| `prov.submit_results(run_id, results)` | Submit eval case results |
| `prov.wait_for_completion(run_id, ...)` | Poll until the eval run finishes |

---

## Notes

- Provenant API failures are **never raised** — logged to stderr only, so your agent keeps running even if the observability layer is down.
- Streaming responses are buffered to completion before recording; individual chunk events are not tracked separately.
- Python 3.8+ required.
