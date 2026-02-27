# Provenant — AgentOps Platform Wiki

**Provenant** is a full-stack AgentOps platform for managing, evaluating, and governing AI agents across their entire lifecycle — from development through production.

---

## Table of Contents

| # | Page | What you'll learn |
|---|------|-------------------|
| 1 | [Getting Started](./01-getting-started.md) | Registration, login, workspace setup |
| 2 | [Core Concepts](./02-core-concepts.md) | Key entities and how they relate |
| 3 | [Agents](./03-agents.md) | Creating and versioning agents |
| 4 | [Environments](./04-environments.md) | Dev / Staging / Production environments |
| 5 | [Promotions](./05-promotions.md) | Promoting agent versions between environments |
| 6 | [Configs](./06-configs.md) | Per-environment agent configuration and secrets |
| 7 | [Evaluations](./07-evaluations.md) | Building eval suites, running evals, viewing results |
| 8 | [Drift Detection](./08-drift.md) | Detecting model drift over time |
| 9 | [Sessions](./09-sessions.md) | Capturing and replaying live agent sessions |
| 10 | [Integrations](./10-integrations.md) | GitHub, GitLab, Slack and webhook integrations |
| 11 | [Policies](./11-policies.md) | Governance rules and violation tracking |
| 12 | [Audit Log](./12-audit-log.md) | Full audit trail for compliance |
| 13 | [API Reference](./13-api-reference.md) | Complete REST API documentation |

---

## Quick Start (30 seconds)

```bash
# 1. Clone and install
git clone <repo>
cd provenant
pnpm install

# 2. Start the API (port 4000)
pnpm --filter api dev

# 3. Start the web UI (port 5173)
pnpm --filter web dev

# 4. Open http://localhost:5173 and register
```

No Docker, no external services required. SQLite is used out of the box.

---

## Architecture at a Glance

```
apps/
├── api/          Express + Prisma + SQLite  (port 4000)
└── web/          React + Vite + Tailwind    (port 5173)
```

All API routes live at `/api/*`. The web app talks exclusively to `http://localhost:4000`.
