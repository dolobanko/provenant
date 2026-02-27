# Core Concepts

Understanding the five core entities in Provenant will make everything else click.

---

## Entity Map

```
Organization
└── Agent
    ├── AgentVersion  (immutable snapshots)
    │   └── promoted into →  Environment
    │       └── AgentConfig   (config + secrets per env)
    ├── EvalSuite
    │   ├── EvalCase
    │   └── EvalRun → EvalCaseResult
    ├── DriftReport
    ├── Session → SessionTurn
    └── PolicyViolation ← Policy
```

---

## Organization

Every user belongs to exactly one **Organization**. All data (agents, environments, configs, policies, audit logs) is scoped to the organization. Multi-org support is not yet implemented — each workspace is single-tenant.

---

## Agent

An **Agent** is the top-level entity representing an AI agent — think of it like a GitHub repository. It has:

- A unique **slug** (`my-agent`, `customer-support-bot`)
- A **model family** label (e.g. `gpt-4`, `claude-3`)
- **Tags** for filtering
- A **status**: `ACTIVE` or `ARCHIVED`

Agents don't run code — they're the organizational wrapper for versions, configs, evals, and sessions.

---

## AgentVersion

An **AgentVersion** is an immutable snapshot of an agent at a point in time — like a git tag. It contains:

- **Semver** (`1.0.0`, `2.3.1-beta`)
- **System prompt**
- **Model ID** (`gpt-4o`, `claude-3-5-sonnet`)
- **Parameters** (temperature, max tokens, etc. as JSON)
- **Tools** (list of tool definitions as JSON)
- **Status**: `DRAFT` → `PUBLISHED` → `DEPRECATED`

Only `PUBLISHED` versions can be promoted to environments.

---

## Environment

An **Environment** is a deployment target. Three are created automatically at registration:

| Environment | Slug | Requires Approval |
|-------------|------|------------------|
| Development | `development` | No |
| Staging | `staging` | Yes |
| Production | `production` | Yes |

You can create custom environments (e.g. `canary`, `europe-prod`). Environments with **requiresApproval = true** need an explicit approve/reject step before a promotion completes.

---

## AgentConfig

An **AgentConfig** is the per-environment runtime configuration for an agent. It stores:

- A **config** object — arbitrary JSON passed to the agent at runtime
- An **overrides** object — values that take precedence over defaults
- **Secrets** — encrypted key-value pairs (e.g. API keys, connection strings) — write-only, never readable after storing

One config exists per `(agent × environment)` pair, created or updated via upsert.

---

## EvalSuite / EvalCase / EvalRun

| Entity | Description |
|--------|-------------|
| **EvalSuite** | A named collection of test cases for an agent |
| **EvalCase** | A single test: an `input` object, optional `expectedOutput`, a scoring function, and a weight |
| **EvalRun** | An execution of a suite against a specific agent version. Produces pass/fail + score per case |

Runs are async — status progresses `QUEUED → RUNNING → COMPLETED` (or `FAILED`).

---

## DriftReport / DriftBaseline

A **DriftBaseline** captures the "known good" metrics for an agent (pass rate, score, latency). A **DriftReport** compares a current eval run against a baseline and produces:

- A **drift score** (0–100)
- A **severity** (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- A **dimensions** breakdown (score delta, pass-rate delta, etc.)

---

## Session / SessionTurn

A **Session** is a captured conversation between a user and an agent. Each turn records:

- **Role**: `USER`, `ASSISTANT`, `SYSTEM`, or `TOOL`
- **Content**: string or structured JSON
- **Tool calls** made in that turn
- **Latency** and **token counts**

Sessions are used for debugging, replay analysis, and feeding back into evals.

---

## Policy / PolicyViolation

A **Policy** defines a governance rule for your agents (deployment gates, content filters, rate limits, data privacy, approval workflows). Each policy has:

- A **type**: `DEPLOYMENT`, `CONTENT`, `RATE_LIMIT`, `DATA_PRIVACY`, or `APPROVAL`
- An **enforcement level**: `WARN`, `BLOCK`, or `NOTIFY`
- A **rules** array (JSON, evaluated at runtime)

When a rule is violated, a **PolicyViolation** is created. Violations can be resolved manually.

---

## AuditLog

Every create/update/delete action in Provenant is automatically recorded in the **AuditLog** with:

- Who did it (user ID + email)
- What they did (action name, resource type, resource ID)
- When (timestamp)
- Before/after state (JSON diff)
- IP address and user agent

Audit logs are immutable and exportable as NDJSON.
