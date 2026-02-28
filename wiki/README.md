# Provenant — AgentOps Platform

**Provenant** is the operations platform for AI agents. It gives your team a single place to register agents, track every conversation, run automated evaluations, detect model drift, enforce governance policies, and connect to your existing tools — without changing how you write AI code.

Think of it as **GitHub + Datadog, but for AI agents**.

---

## What Problem Does Provenant Solve?

When you deploy an AI agent to production, you immediately hit questions like:

- *Did this agent actually work correctly today?*
- *Did the model provider silently change behaviour?*
- *Who approved this deployment, and what was the system prompt?*
- *Why did this user's conversation go wrong?*
- *Is our agent compliant with our data privacy policy?*

Provenant answers all of these, automatically.

---

## Platform Overview

```
┌─────────────────────────────────────────────────────┐
│                     Provenant                        │
│                                                      │
│  Agents ──► Versions ──► Environments                │
│      │                        │                      │
│      ├── Evaluations          └── Configs & Secrets  │
│      ├── Sessions (live logs)                        │
│      ├── Drift Detection                             │
│      ├── Policies & Violations                       │
│      └── Audit Log                                   │
│                                                      │
│  Integrations: GitHub · GitLab · Slack · Webhooks   │
│  Connect via:  Python SDK · TypeScript SDK ·         │
│                Claude Code Hooks · ChatGPT Extension │
└─────────────────────────────────────────────────────┘
```

---

## Core Features

### 🤖 Agent Registry
Register every AI agent your team builds. Track its model, system prompt, tools, and parameters as immutable versioned snapshots — like git tags for your agent's "brain".

### 🌐 Environments
Manage Development, Staging, and Production environments. Each environment can have its own configuration and secrets. Promote versions through environments with optional approval gates.

### 🧪 Evaluations
Build automated test suites with input/output cases. Run them against any agent version. Track pass rates and scores over time. Gate CI/CD deployments on eval results.

### 📈 Drift Detection
Set a "known good" baseline from a passing eval run. Provenant continuously compares new runs against the baseline and alerts you when model behaviour deviates — even if the provider didn't announce a change.

### 💬 Sessions
Every conversation your agent has can be logged to Provenant in real-time. Browse, search, and replay sessions in the UI. Use them to debug failures and feed bad sessions back into eval suites.

### 🛡️ Policies
Define governance rules: deployment gates, content filters, rate limits, data privacy constraints, approval workflows. Violations are tracked and can block deployments.

### 📋 Audit Log
Every action — every deployment, config change, approval, deletion — is recorded with who did it, when, and what changed. Fully exportable for compliance.

### 🔗 Integrations
Connect GitHub, GitLab, Slack, or any HTTP service to receive and send events. Your existing CI/CD pipeline can trigger eval runs and get pass/fail results back.

---

## How to Connect Your Agent

Provenant works with any AI stack. Pick the integration that fits:

| Method | Best for | Effort |
|--------|----------|--------|
| [Python SDK](16-sdks.md) | Any Python agent (OpenAI, Anthropic, etc.) | ~10 lines |
| [TypeScript SDK](16-sdks.md) | Any Node.js agent | ~10 lines |
| [Claude Code Hooks](19-claude-code-hooks.md) | Claude Code CLI users | 1 command |
| [ChatGPT Extension](20-chatgpt-extension.md) | ChatGPT web users | Load extension |
| [REST API](13-api-reference.md) | Any language, full control | Manual |

---

## Quick Start

### Option A — One command (stays running in background)

```bash
bash dev.sh
```

Then open **http://localhost:5173** and register.

### Option B — Manual

```bash
# Terminal 1
pnpm --filter api dev

# Terminal 2
pnpm --filter web dev
```

---

## Table of Contents

### Getting Started
| | |
|--|--|
| [Quick Start & Installation](01-getting-started.md) | Register, log in, first agent |
| [Core Concepts](02-core-concepts.md) | Understand the data model |

### Agent Management
| | |
|--|--|
| [Agents](03-agents.md) | Create and version agents |
| [Environments](04-environments.md) | Dev / Staging / Production |
| [Promotions](05-promotions.md) | Deploy versions between environments |
| [Configs & Secrets](06-configs.md) | Per-environment configuration |

### Quality & Safety
| | |
|--|--|
| [Evaluations](07-evaluations.md) | Automated test suites |
| [Drift Detection](08-drift.md) | Detect model degradation |
| [Policies](11-policies.md) | Governance rules |

### Observability
| | |
|--|--|
| [Sessions](09-sessions.md) | Live conversation logging |
| [Audit Log](12-audit-log.md) | Full activity trail |

### Integrations
| | |
|--|--|
| [GitHub / GitLab / Slack / Webhooks](10-integrations.md) | External service integrations |
| [Claude Code Hooks](19-claude-code-hooks.md) | Auto-log Claude Code sessions |
| [ChatGPT Extension](20-chatgpt-extension.md) | Auto-log ChatGPT conversations |

### Reference
| | |
|--|--|
| [Authentication & API Keys](14-authentication.md) | Auth methods |
| [SDKs — Python & TypeScript](16-sdks.md) | SDK reference |
| [CI/CD & GitHub Actions](17-ci-cd.md) | Automate with GitHub Actions |
| [API Reference](13-api-reference.md) | Full REST API docs |
| [Team Management](15-team-management.md) | Invite and manage teammates |
| [Troubleshooting](18-troubleshooting.md) | Common issues |

---

## Architecture

```
apps/
├── api/     Express + Prisma + SQLite   (port 4000)
└── web/     React + Vite + Tailwind     (port 5173)

packages/
├── sdk-ts/              TypeScript SDK
├── sdk-py/              Python SDK
├── hooks-claude/        Claude Code hooks integration
└── extension-chatgpt/   Chrome extension for ChatGPT
```

All API routes live at `/api/*`. The web app proxies to `http://localhost:4000` in development.

---

*Provenant — know what your agents are doing.*
