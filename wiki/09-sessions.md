# Sessions

Sessions capture real conversations between users and your agents. Use them for debugging, quality review, feeding back into eval suites, or replaying to understand failures.

---

## What is a Session?

A **Session** is an ordered sequence of **Turns** (messages). It tracks:
- Which agent and version handled the conversation
- Which environment it ran in
- Start/end time, total tokens, total latency
- Arbitrary metadata tags

---

## Creating a Session (via API)

Sessions are typically created programmatically from your agent backend, not through the UI. Use the REST API:

```bash
POST /api/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "agentId": "agent-uuid",
  "agentVersionId": "version-uuid",      # optional
  "environmentId": "environment-uuid",   # optional
  "externalId": "conv_abc123",           # your own ID for this conversation
  "userId": "user_xyz",                  # end-user identifier
  "metadata": {
    "channel": "web",
    "locale": "en-US"
  },
  "tags": ["support", "billing"]
}
```

Response includes a `session.id` — store this and attach it to every subsequent turn.

---

## Appending Turns

```bash
POST /api/sessions/:sessionId/turns
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "USER",
  "content": "I want to cancel my subscription",
  "toolCalls": [],
  "latencyMs": 0,
  "inputTokens": 12,
  "outputTokens": 0,
  "metadata": {}
}
```

Then the agent response:

```bash
POST /api/sessions/:sessionId/turns

{
  "role": "ASSISTANT",
  "content": "I'm sorry to hear that. Can you tell me the reason so I can help?",
  "toolCalls": [],
  "latencyMs": 1340,
  "inputTokens": 156,
  "outputTokens": 28,
  "metadata": { "model": "gpt-4o", "finish_reason": "stop" }
}
```

### Roles

| Role | When to use |
|------|------------|
| `USER` | Human input |
| `ASSISTANT` | Agent response |
| `SYSTEM` | System prompt injection (mid-conversation) |
| `TOOL` | Tool call result |

### Content Format

`content` can be:
- A plain **string**: `"Hello, how can I help?"`
- A **JSON object**: `{ "type": "text", "text": "Hello" }`
- A **JSON array**: for multi-part messages with tool calls

---

## Ending a Session

When the conversation finishes:

```bash
POST /api/sessions/:sessionId/end
Authorization: Bearer <token>
Content-Type: application/json

{
  "totalTokens": 1840,
  "totalLatencyMs": 8230
}
```

This sets `status: COMPLETED` and records the final stats.

---

## Browsing Sessions in the UI

1. Click **Sessions** in the sidebar
2. Filter by:
   - **Agent** — narrow to a specific agent
   - **Environment** — see only production sessions
   - **Status** — `ACTIVE`, `COMPLETED`, `FAILED`

The list shows each session with agent, environment, status, turn count, start time, and total tokens.

---

## Session Detail View

Click any session to see the full conversation thread:

- Each turn is displayed with role, timestamp, latency, and token counts
- `TOOL` turns show the tool call payload
- The session header shows total tokens, duration, and metadata

---

## Session Statuses

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Conversation is ongoing |
| `COMPLETED` | Session was ended normally |
| `FAILED` | Session ended due to an error |
| `REPLAYING` | Session is being replayed (future feature) |

---

## Integration Pattern

```python
import requests

BASE = "http://localhost:4000"
HEADERS = {"Authorization": f"Bearer {token}"}

# Start session
session = requests.post(f"{BASE}/api/sessions", json={
    "agentId": AGENT_ID,
    "environmentId": ENV_ID,
    "userId": user_id,
}, headers=HEADERS).json()

session_id = session["id"]

# Per turn — call your LLM, then log both sides
requests.post(f"{BASE}/api/sessions/{session_id}/turns", json={
    "role": "USER",
    "content": user_message,
}, headers=HEADERS)

response = call_your_llm(user_message)

requests.post(f"{BASE}/api/sessions/{session_id}/turns", json={
    "role": "ASSISTANT",
    "content": response.text,
    "latencyMs": response.latency_ms,
    "outputTokens": response.usage.output_tokens,
}, headers=HEADERS)

# End session
requests.post(f"{BASE}/api/sessions/{session_id}/end", json={
    "totalTokens": total_tokens,
}, headers=HEADERS)
```

---

## Tips

- **Log everything in production** — even if you don't look at every session, having them available for debugging is invaluable.
- **Use `externalId`** to link Provenant sessions back to your own conversation IDs.
- **Use `userId`** to correlate sessions to specific end users for support investigations.
- **Tag sessions** (`vip-user`, `high-value`, `error-reported`) so you can filter for exactly what you need.
