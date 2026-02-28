# Claude Code Hooks

The **Claude Code Hooks** integration automatically logs every Claude Code session to Provenant — every tool call, every conversation — without writing a single line of SDK code.

It works by hooking into Claude Code's lifecycle events (PostToolUse, Stop) via the `~/.claude/settings.json` hooks system.

---

## How It Works

```
You use Claude Code normally
        │
        ▼
Claude Code fires hook events (PostToolUse, Stop)
        │
        ▼
hooks-claude/index.js receives the event via stdin
        │
        ▼
Provenant API: creates session → records turns → ends session
        │
        ▼
Session appears in your Provenant dashboard in real-time
```

Every tool call (Bash, Read, Edit, Write, etc.) becomes a `TOOL` turn in the session. When Claude Code finishes, the session is automatically closed.

---

## Setup

### Step 1 — Get your credentials

1. Open Provenant → **Agents** → create an agent named `Claude Code` (or use an existing one)
2. Copy the **Agent ID** from the agent detail page
3. Open **API Keys** → create a new key → copy it

### Step 2 — Run the installer

From the project root:

```bash
node packages/hooks-claude/install.js
```

The installer will ask for:

| Prompt | What to enter |
|--------|--------------|
| API Key | `pk_live_...` from the API Keys page |
| Agent ID | The UUID from the agent detail page |
| Base URL | `http://localhost:4000` (default, just press Enter) |

The installer:
1. Saves your config to `~/.provenant/hooks-config.json`
2. Patches `~/.claude/settings.json` to register the hooks

### Step 3 — Use Claude Code normally

That's it. Every new Claude Code session will automatically appear in Provenant → **Sessions**.

---

## What Gets Logged

| Claude Code event | What Provenant records |
|-------------------|----------------------|
| First tool call | Creates a new Session |
| Each tool call (Bash, Read, Edit, etc.) | Adds a `TOOL` turn with tool name + output |
| Session ends (Stop event) | Closes the Session as `COMPLETED` |

### Example session in Provenant

```
Session: Claude Code · Development
├── TOOL  Bash: git status → "On branch main, nothing to commit"
├── TOOL  Read: src/index.ts → (file contents)
├── TOOL  Edit: src/index.ts → (diff applied)
├── TOOL  Bash: npm test → "✓ 12 tests passed"
└── Session ended · 4 turns · 2m 34s
```

---

## Config File

The config lives at `~/.provenant/hooks-config.json`:

```json
{
  "apiKey": "pk_live_your_api_key",
  "agentId": "your-agent-uuid",
  "baseUrl": "http://localhost:4000"
}
```

To update any value, just edit this file directly — no need to re-run the installer.

### Common fixes

**Sessions not appearing?** Check that `baseUrl` points to the API (port **4000**), not the web UI (port **5173**).

**Sessions in wrong org?** Make sure `apiKey` is from the same org you're logged into in the dashboard. Go to API Keys page and create a fresh key.

---

## How Claude Code Hooks Work

Claude Code fires shell scripts at lifecycle events. Provenant registers two hooks in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "node ~/.provenant/hooks/index.js" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "node ~/.provenant/hooks/index.js" }]
      }
    ]
  }
}
```

Each hook receives a JSON payload on `stdin` with:
- `event_type` — `PostToolUse` or `Stop`
- `session_id` — unique ID for the current Claude Code session
- `tool_name` — which tool was called (for PostToolUse)
- `tool_input` — what was passed to the tool
- `tool_response` — what the tool returned

The hook script uses `session_id` to stitch all tool calls in one Claude Code session into a single Provenant session.

---

## Uninstalling

To remove the hooks, edit `~/.claude/settings.json` and delete the `PostToolUse` and `Stop` entries that reference `~/.provenant/hooks/index.js`.

To also remove your config:

```bash
rm -rf ~/.provenant
```

---

→ Next: [ChatGPT Extension](20-chatgpt-extension.md)
