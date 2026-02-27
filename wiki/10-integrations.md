# Integrations

Integrations connect Provenant to external services — your source code platform, communication tools, and CI/CD webhooks — so agent deployments fit into your existing workflow.

---

## Supported Integration Types

| Type | Use Case |
|------|---------|
| `GITHUB` | Trigger eval runs on PR, deploy on merge |
| `GITLAB` | Same as GitHub for GitLab repos |
| `SLACK` | Send notifications for drift alerts, violations, promotions |
| `WEBHOOK` | Generic HTTP webhook receiver for any service |

---

## Creating an Integration

1. Click **Integrations** in the sidebar
2. Click **New Integration**
3. Fill in:

| Field | Required | Description |
|-------|----------|-------------|
| Type | ✅ | `GITHUB`, `GITLAB`, `SLACK`, or `WEBHOOK` |
| Name | ✅ | Friendly label (e.g. `Main GitHub Repo`) |
| Config | ✅ | JSON configuration for this integration (see below) |

4. Click **Create**

---

## Config Examples by Type

### GitHub

```json
{
  "repo": "my-org/my-agent-repo",
  "branch": "main",
  "token": "ghp_xxxx"
}
```

> **Note:** Store the `token` as a **Secret** (see [Configs](./06-configs.md)) rather than in the config JSON for production use.

### GitLab

```json
{
  "project_id": "12345",
  "branch": "main",
  "token": "glpat-xxxx"
}
```

### Slack

```json
{
  "webhook_url": "https://hooks.slack.com/services/T.../B.../xxx",
  "channel": "#agent-alerts",
  "username": "Provenant Bot"
}
```

### Webhook (Generic)

```json
{
  "description": "Production monitoring webhook",
  "events": ["drift.critical", "violation.high"]
}
```

---

## Webhook Receiver

Every integration gets a unique webhook endpoint:

```
POST /api/integrations/webhook/:integrationId
```

This endpoint is **unauthenticated** — designed to receive incoming webhooks from GitHub, GitLab, or any external service. Use the integration's secret to verify payloads on your side.

### Example: GitHub Webhook Setup

1. Create a `GITHUB` integration in Provenant — copy the integration ID
2. In GitHub repo settings → Webhooks → Add webhook:
   - **Payload URL:** `http://your-server:4000/api/integrations/webhook/<integrationId>`
   - **Content type:** `application/json`
   - **Events:** Push, Pull Request
3. Provenant receives the payload, creates a `WebhookEvent` record, and processes it async

### Webhook Event Statuses

| Status | Meaning |
|--------|---------|
| `RECEIVED` | Payload received and stored |
| `PROCESSING` | Being handled asynchronously |
| `PROCESSED` | Successfully handled ✅ |
| `FAILED` | Processing failed (error stored) |

---

## Viewing Webhook Events

1. Click an integration in the list
2. Scroll to **Recent Events** — the last 50 events are shown with status, event type, and timestamp

---

## Security Notes

- Sensitive config values (fields with `secret` or `token` in the key name) are automatically **masked** (`***`) in the UI list view
- Store API tokens in **Secrets** (via the Configs page) rather than integration config JSON for maximum security
- Webhook endpoints don't require authentication — validate the `X-Hub-Signature` header from GitHub/GitLab in your processing logic

---

## Deactivating an Integration

Integrations have an `isActive` flag. When `isActive = false`, the webhook endpoint returns 404. Use the API to deactivate:

```bash
PATCH /api/integrations/:id
{ "isActive": false }
```
