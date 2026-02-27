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
# Clone the repo
git clone <repo-url>
cd provenant

# Install all dependencies (monorepo — installs both api and web)
pnpm install
```

---

## Running the App

Open **two terminal tabs** and run:

```bash
# Terminal 1 — API server (http://localhost:4000)
pnpm --filter api dev

# Terminal 2 — Web UI (http://localhost:5173)
pnpm --filter web dev
```

Or run both at once from the root:

```bash
pnpm dev
```

---

## First Login — Creating Your Workspace

1. Open **http://localhost:5173** in your browser
2. You'll be redirected to the **Register** page
3. Fill in:
   - **Your name** — displayed in the sidebar and audit log
   - **Email** — used to log in
   - **Password** — minimum 8 characters
   - **Organization name** — e.g. `Acme AI`
   - **Organization slug** — lowercase, hyphens only, e.g. `acme-ai`
4. Click **Create workspace**

On success you'll be taken straight to the **Dashboard**. Three environments are automatically created for you: **Development**, **Staging**, and **Production**.

---

## Dashboard Overview

The dashboard gives you an at-a-glance view of your workspace:

| Card | What it shows |
|------|--------------|
| Agents | Total registered agents |
| Environments | Total environments (starts at 3) |
| Eval Runs | Total evaluation runs |
| Sessions | Total captured agent sessions |
| Open Drifts | Unresolved drift reports |
| Open Violations | Unresolved policy violations |

Below the stat cards you'll see:
- **Recent Eval Runs** — latest 5 runs with status and scores
- **Drift Reports** — latest unresolved drift alerts

---

## Navigation

The left sidebar gives access to all platform features:

| Icon | Section | Purpose |
|------|---------|---------|
| 📊 | Dashboard | Overview |
| 🤖 | Agents | Register and version your AI agents |
| 🌐 | Environments | Manage dev/staging/prod |
| ↕️ | Promotions | Promote versions between environments |
| ⚙️ | Configs | Per-environment configuration |
| 🧪 | Evaluations | Run automated evals |
| 📈 | Drift Detection | Monitor for model drift |
| 💬 | Sessions | Browse captured conversations |
| 🔗 | Integrations | Connect GitHub, Slack, etc. |
| 🛡️ | Policies | Governance rules |
| 📋 | Audit Log | Full activity trail |

---

## Logging Out

Click the **arrow icon** (→) next to your name at the bottom of the sidebar.

---

## Next Steps

→ [Create your first agent](./03-agents.md)
