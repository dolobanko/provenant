# Provenant — AgentOps Platform

Full-stack AgentOps platform for managing, evaluating, and governing AI agents across environments.

## Architecture

```
provenant/
├── apps/
│   ├── api/          # Express + TypeScript REST API
│   └── web/          # React + Vite + Tailwind frontend
├── docker-compose.yml
└── turbo.json
```

## Quick Start

### 1. Install dependencies
```bash
pnpm install
```

### 2. Start PostgreSQL + Redis
```bash
docker compose up -d
```

### 3. Push DB schema
```bash
pnpm db:push
```

### 4. Start dev servers
```bash
pnpm dev
```

- API: http://localhost:4000
- Web: http://localhost:5173

## Features (8 phases)

| Phase | Feature |
|-------|---------|
| 1 | Agent Registry & Version Control |
| 2 | Agent Configuration Management |
| 3 | Environment Promotion Workflows |
| 4 | Evaluation & Regression Framework |
| 5 | Drift Detection Engine |
| 6 | AI Session Capture |
| 7 | GitHub & GitLab Integration |
| 8 | Governance & Policy Engine + Audit |

## API Reference

### Auth
```
POST /api/auth/register   — create org + user
POST /api/auth/login      — get JWT
GET  /api/auth/me         — current user
```

### Agents
```
GET/POST   /api/agents
GET/PATCH  /api/agents/:id
GET/POST   /api/agents/:id/versions
POST       /api/agents/:id/versions/:vId/publish
POST       /api/agents/:id/versions/:vId/deprecate
```

### Environments & Promotions
```
GET/POST   /api/environments
GET/POST   /api/environments/promotions
POST       /api/environments/promotions/:id/approve
POST       /api/environments/promotions/:id/reject
```

### Configs
```
GET/POST   /api/configs
POST       /api/configs/:id/secrets
DELETE     /api/configs/:id/secrets/:key
```

### Evaluations
```
GET/POST   /api/evals/suites
GET/POST   /api/evals/suites/:id/cases
GET/POST   /api/evals/runs
GET        /api/evals/runs/:id
POST       /api/evals/runs/:id/results
```

### Drift Detection
```
GET/POST   /api/drift/reports
POST       /api/drift/reports/:id/resolve
GET/POST   /api/drift/baselines
POST       /api/drift/compute
```

### Sessions
```
GET/POST   /api/sessions
GET        /api/sessions/:id
POST       /api/sessions/:id/turns
POST       /api/sessions/:id/end
```

### Integrations
```
GET/POST         /api/integrations
GET              /api/integrations/:id/events
POST             /api/integrations/webhook/:integrationId
```

### Policies
```
GET/POST   /api/policies
GET/POST   /api/policies/violations
POST       /api/policies/violations/:id/resolve
POST       /api/policies/evaluate
```

### Audit
```
GET    /api/audit
GET    /api/audit/stats
GET    /api/audit/export    (NDJSON download)
```
