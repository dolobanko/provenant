# API Reference

Base URL: `http://localhost:4000`

All endpoints (except auth and webhook receiver) require:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Tokens are obtained from `POST /api/auth/login` or `POST /api/auth/register`.

---

## Authentication

### Register
```
POST /api/auth/register
```
```json
{
  "name": "Jane Smith",
  "email": "jane@acme.com",
  "password": "mysecretpassword",
  "orgName": "Acme AI",
  "orgSlug": "acme-ai"
}
```
**Response:** `{ token, user, org }`

---

### Login
```
POST /api/auth/login
```
```json
{ "email": "jane@acme.com", "password": "mysecretpassword" }
```
**Response:** `{ token, user, org }`

---

### Get Current User
```
GET /api/auth/me
```
**Response:** `{ id, name, email, role, orgId, org }`

---

## Agents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/agents` | List all agents |
| `POST` | `/api/agents` | Create agent |
| `GET` | `/api/agents/:id` | Get agent with versions |
| `PATCH` | `/api/agents/:id` | Update agent |
| `DELETE` | `/api/agents/:id` | Archive agent |
| `GET` | `/api/agents/:id/versions` | List versions |
| `POST` | `/api/agents/:id/versions` | Create version |
| `PATCH` | `/api/agents/:id/versions/:vId` | Update version |
| `POST` | `/api/agents/:id/versions/:vId/publish` | Publish version |
| `POST` | `/api/agents/:id/versions/:vId/deprecate` | Deprecate version |

**Create Agent body:**
```json
{
  "name": "Customer Support Bot",
  "slug": "customer-support-bot",
  "description": "Handles tier-1 support tickets",
  "modelFamily": "gpt-4",
  "tags": ["support", "customer-facing"]
}
```

**Create Version body:**
```json
{
  "version": "v2 with tools",
  "semver": "2.0.0",
  "changelog": "Added refund tool, improved tone",
  "systemPrompt": "You are a helpful support agent...",
  "modelId": "gpt-4o-2024-11-20",
  "parameters": { "temperature": 0.7, "max_tokens": 1024 },
  "tools": [{ "name": "process_refund", "description": "..." }]
}
```

---

## Environments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/environments` | List environments |
| `POST` | `/api/environments` | Create environment |
| `GET` | `/api/environments/:id` | Get environment |
| `PATCH` | `/api/environments/:id` | Update environment |
| `POST` | `/api/environments/promotions` | Create promotion |
| `GET` | `/api/environments/promotions` | List promotions |
| `POST` | `/api/environments/promotions/:id/approve` | Approve promotion |
| `POST` | `/api/environments/promotions/:id/reject` | Reject promotion |

**Create Environment body:**
```json
{
  "name": "Canary",
  "slug": "canary",
  "type": "CUSTOM",
  "description": "5% traffic canary",
  "requiresApproval": false
}
```

**Create Promotion body:**
```json
{
  "agentVersionId": "version-uuid",
  "fromEnvId": "staging-uuid",
  "toEnvId": "production-uuid",
  "notes": "Fixes JIRA-1234, eval pass rate 96%"
}
```

---

## Configs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/configs` | List configs (filter: `?agentId=&environmentId=`) |
| `POST` | `/api/configs` | Create/update config (upsert) |
| `GET` | `/api/configs/:id` | Get config with secrets list |
| `PATCH` | `/api/configs/:id` | Partial update config |
| `POST` | `/api/configs/:id/secrets` | Set a secret |
| `DELETE` | `/api/configs/:id/secrets/:key` | Delete a secret |

**Upsert Config body:**
```json
{
  "agentId": "agent-uuid",
  "environmentId": "environment-uuid",
  "config": { "temperature": 0.7, "max_tokens": 1024 },
  "overrides": { "temperature": 0.3 },
  "inheritFrom": null
}
```

---

## Evaluations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/evals/suites` | List suites |
| `POST` | `/api/evals/suites` | Create suite |
| `GET` | `/api/evals/suites/:id` | Get suite with cases |
| `PATCH` | `/api/evals/suites/:id` | Update suite |
| `DELETE` | `/api/evals/suites/:id` | Delete suite |
| `POST` | `/api/evals/suites/:id/cases` | Add test case |
| `PATCH` | `/api/evals/suites/:suiteId/cases/:id` | Update case |
| `DELETE` | `/api/evals/suites/:suiteId/cases/:id` | Delete case |
| `GET` | `/api/evals/runs` | List runs (filter: `?agentId=&suiteId=`) |
| `POST` | `/api/evals/runs` | Start eval run |
| `GET` | `/api/evals/runs/:id` | Get run with results |
| `POST` | `/api/evals/runs/:id/results` | Submit external results |

**Create Run body:**
```json
{
  "suiteId": "suite-uuid",
  "agentId": "agent-uuid",
  "agentVersionId": "version-uuid",
  "environmentId": "environment-uuid",
  "metadata": { "triggered_by": "ci" }
}
```

---

## Drift Detection

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/drift/reports` | List drift reports |
| `POST` | `/api/drift/reports` | Create report |
| `GET` | `/api/drift/reports/:id` | Get report |
| `POST` | `/api/drift/reports/:id/resolve` | Resolve report |
| `GET` | `/api/drift/baselines` | List baselines |
| `POST` | `/api/drift/baselines` | Set baseline |
| `POST` | `/api/drift/compute` | Compute drift between two runs |

**Compute Drift body:**
```json
{
  "baselineRunId": "run-uuid-baseline",
  "currentRunId": "run-uuid-current"
}
```

**Compute Drift response:**
```json
{
  "driftScore": 18.4,
  "severity": "MEDIUM",
  "dimensions": {
    "scoreDelta": 6.2,
    "passRateDelta": 0.15,
    "baselineScore": 88.1,
    "currentScore": 81.9,
    "baselinePassRate": 0.96,
    "currentPassRate": 0.81
  }
}
```

---

## Sessions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions` | List sessions (filter: `?agentId=&environmentId=&status=`) |
| `POST` | `/api/sessions` | Create session |
| `GET` | `/api/sessions/:id` | Get session with turns |
| `POST` | `/api/sessions/:id/turns` | Append turn |
| `POST` | `/api/sessions/:id/end` | End session |
| `DELETE` | `/api/sessions/:id` | Delete session |

---

## Integrations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/integrations` | List integrations |
| `POST` | `/api/integrations` | Create integration |
| `PATCH` | `/api/integrations/:id` | Update integration |
| `DELETE` | `/api/integrations/:id` | Delete integration |
| `GET` | `/api/integrations/:id/events` | List webhook events |
| `POST` | `/api/integrations/webhook/:integrationId` | Receive webhook (no auth) |

---

## Policies

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/policies` | List policies |
| `POST` | `/api/policies` | Create policy |
| `GET` | `/api/policies/:id` | Get policy with violations |
| `PATCH` | `/api/policies/:id` | Update policy |
| `DELETE` | `/api/policies/:id` | Delete policy |
| `POST` | `/api/policies/violations` | Record violation |
| `GET` | `/api/policies/violations` | List all violations |
| `POST` | `/api/policies/violations/:id/resolve` | Resolve violation |
| `POST` | `/api/policies/evaluate` | Evaluate resource against all policies |

---

## Audit Log

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/audit` | Query audit logs (filterable) |
| `GET` | `/api/audit/actions` | List distinct action names |
| `GET` | `/api/audit/stats` | Aggregated stats |
| `GET` | `/api/audit/export` | Export as NDJSON |

**Query params for `GET /api/audit`:**
- `userId` — filter by user
- `action` — partial match on action name
- `resourceType` — e.g. `Agent`
- `resourceId` — specific record UUID
- `from` — ISO date (e.g. `2025-01-01`)
- `to` — ISO date
- `limit` — max results (default 50, max 200)
- `offset` — pagination offset

---

## Health Check

```
GET /health
```
```json
{ "status": "ok", "ts": "2025-06-15T10:00:00.000Z" }
```

No authentication required.

---

## Error Responses

All errors follow a consistent format:

```json
{ "error": "Human-readable error message" }
```

| Status Code | Meaning |
|-------------|---------|
| `400` | Validation error (Zod schema failure) |
| `401` | Missing or invalid JWT token |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate email or slug) |
| `429` | Rate limit exceeded (200 req/min) |
| `500` | Internal server error |

---

## Rate Limiting

All API endpoints are rate-limited to **200 requests per minute** per IP address. Exceeded requests return `429 Too Many Requests`.
