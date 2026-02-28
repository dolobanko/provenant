# @provenant/mcp-server

MCP (Model Context Protocol) server for [Provenant](https://provenant.dev) — the Business Intelligence platform for AI agents.

Connect Claude Desktop, Claude Code, or any MCP-compatible client to your Provenant platform to manage agents, log conversations, and query analytics directly from your AI workflow.

## Tools

| Tool | Description |
|------|-------------|
| `list_agents` | List all registered agents in your org |
| `get_agent` | Get a specific agent with all versions |
| `create_session` | Start a new conversation session |
| `log_turn` | Append a USER/ASSISTANT/TOOL/SYSTEM turn to a session |
| `end_session` | Mark a session as completed |
| `list_conversations` | List recent conversations (supports search) |
| `get_overview` | High-level metrics: agents, sessions, eval runs, drift reports, violations |

## Quick Start

### 1. Build

```bash
pnpm install
pnpm build
```

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "provenant": {
      "command": "node",
      "args": ["/path/to/provenant/packages/mcp-server/dist/index.js"],
      "env": {
        "PROVENANT_API_KEY": "pk_live_your_api_key",
        "PROVENANT_BASE_URL": "http://localhost:4000"
      }
    }
  }
}
```

### 3. Configure Claude Code

Add to `.claude/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "provenant": {
      "command": "node",
      "args": ["/path/to/provenant/packages/mcp-server/dist/index.js"],
      "env": {
        "PROVENANT_API_KEY": "pk_live_your_api_key",
        "PROVENANT_BASE_URL": "http://localhost:4000"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROVENANT_API_KEY` | *(required)* | Your Provenant API key from Settings → API Keys |
| `PROVENANT_BASE_URL` | `http://localhost:4000` | Base URL of your Provenant API |

## Example Usage

Once connected, you can ask Claude:

- *"List all my AI agents in Provenant"*
- *"Create a session for the customer-support agent and log this conversation"*
- *"How many sessions have been recorded this week?"*
- *"Search conversations mentioning 'billing issue'"*
