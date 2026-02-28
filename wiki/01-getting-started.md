# Getting Started

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime |
| pnpm | 8+ | Package manager |

> No Docker, no PostgreSQL, no Redis needed. Everything runs locally with SQLite.

---

## Installation

```bash
git clone <repo-url>
cd provenant
pnpm install
```

---

## Starting the Servers

### Recommended — background mode (stays alive)

```bash
bash dev.sh
```

Both servers start in the background and keep running even if you close the terminal. Logs go to `api.log` and `web.log` in the project root.

```bash
# Check logs
tail -f api.log
tail -f web.log

# Stop everything
bash stop.sh
```

### Manual — foreground mode

```bash
# Terminal 1 — API server (http://localhost:4000)
pnpm --filter api dev

# Terminal 2 — Web UI (http://localhost:5173)
pnpm --filter web dev
```

---

## Creating Your Account

Open **http://localhost:5173** — you'll land on the login page.

### Option A — Sign in with GitHub (easiest)

Click **Continue with GitHub**. You'll be taken to GitHub to authorise the app, then redirected straight to the dashboard. No password needed.

### Option B — Email & Password

Click **No account? Register** and fill in:

| Field | Example |
|-------|---------|
| Your name | `Artem Dolobanko` |
| Email | `artem@acme.ai` |
| Password | 8+ characters |
| Organization name | `Acme AI` |
| Organization slug | `acme-ai` (lowercase, hyphens only) |

Click **Create workspace**. You'll be taken straight to the dashboard with 3 environments pre-created: **Development**, **Staging**, **Production**.

---

## Dashboard Overview

The dashboard shows your workspace health at a glance:

| Card | What it shows |
|------|--------------|
| **Agents** | Total registered agents |
| **Environments** | Total environments (starts at 3) |
| **Eval Runs** | Total evaluation runs |
| **Sessions** | Total captured agent sessions |
| **Open Drifts** | Unresolved drift reports |
| **Open Violations** | Unresolved policy violations |

Below the cards:
- **Recent Eval Runs** — last 5 runs with pass rate and status
- **Drift Reports** — unresolved drift alerts
- **Charts** — session volume and eval trends over 30 days

---

## First Steps Checklist

1. ✅ **Register / log in**
2. 🤖 **[Create an agent](03-agents.md)** — give it a name, model, and system prompt
3. 🔑 **[Get an API key](14-authentication.md)** — needed to connect your code
4. 🔌 **Connect your agent** — pick one:
   - [Python SDK](16-sdks.md) for Python agents
   - [TypeScript SDK](16-sdks.md) for Node.js agents
   - [Claude Code Hooks](19-claude-code-hooks.md) if you use Claude Code
   - [ChatGPT Extension](20-chatgpt-extension.md) if you use ChatGPT
5. 💬 **Watch sessions appear** in the Sessions tab
6. 🧪 **[Create an eval suite](07-evaluations.md)** and run it

---

## Sidebar Navigation

| Section | What it does |
|---------|-------------|
| **Dashboard** | Overview of your workspace |
| **Agents** | Register and version your AI agents |
| **Environments** | Manage dev / staging / production targets |
| **Promotions** | Deploy a version to an environment |
| **Configs** | Per-environment config and secrets |
| **Evaluations** | Create test suites and run evals |
| **Drift Detection** | Monitor for model behaviour changes |
| **Sessions** | Browse all captured conversations |
| **Integrations** | Connect GitHub, Slack, and other services |
| **Policies** | Governance rules and violations |
| **Audit Log** | Who did what, when |
| **API Keys** | Create and revoke API keys |
| **Team** | Invite teammates |
| **Webhooks** | Outbound webhook configuration |

---

## Logging Out

Click the **→** (logout arrow) next to your name at the bottom of the sidebar.

---

→ Next: [Core Concepts](02-core-concepts.md)
