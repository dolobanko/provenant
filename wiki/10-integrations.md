# Integrations

Integrations connect Provenant to external services — GitHub, GitLab, Slack, or any HTTP webhook — so your agent operations fit into the tools you already use.

> **Looking for agent-level integrations?**
> → [Claude Code Hooks](19-claude-code-hooks.md) — zero-code logging for Claude Code
> → [ChatGPT Extension](20-chatgpt-extension.md) — log ChatGPT conversations automatically

---

## Supported Types

| Type | Use Case |
|------|---------|
| **GITHUB** | Receive push/PR events, trigger evals on merge |
| **GITLAB** | Same for GitLab repos |
| **SLACK** | Send alerts for drift, violations, promotions |
| **WEBHOOK** | Generic HTTP receiver for any service |

---

## Creating an Integration

1. Go to **Integrations** in the sidebar
2. Click **+ Add Integration**
3. Select a **Type** — the Config field auto-fills with the right template
4. Fill in a **Name** and replace the placeholder values in the config
5. Click **Add Integration**

The card that appears shows your unique **Webhook URL** — copy it and paste it into GitHub/GitLab/Slack as needed.

---

## GitHub Integration

### What you need

A **GitHub Personal Access Token** with `repo` and `admin:repo_hook` scopes.

**Get one:** github.com/settings/tokens → Generate new token (classic) → check `repo` + `admin:repo_hook`

### Config

```json
{
  "token": "github_pat_xxxx",
  "webhookSecret": "any-random-string-you-choose"
}
```

| Field | Description |
|-------|-------------|
| `token` | Your GitHub Personal Access Token |
| `webhookSecret` | A secret string you make up — you'll paste it into GitHub's webhook settings too |

### Setting up the GitHub webhook

After saving the integration, copy the **Webhook URL** from the card, then:

1. Go to your GitHub repo → **Settings → Webhooks → Add webhook**
2. **Payload URL:** paste the Webhook URL from the card
3. **Content type:** `application/json`
4. **Secret:** paste your `webhookSecret` value
5. **Events:** choose "Send me everything" or select specific events (Push, Pull Request, etc.)
6. Click **Add webhook**

GitHub will immediately send a ping event — you'll see it appear in the integration's event log.

### Events Provenant receives

| GitHub event | `x-github-event` header |
|-------------|------------------------|
| Push to branch | `push` |
| Pull request opened/merged | `pull_request` |
| Release published | `release` |
| Issue created | `issues` |

---

## GitLab Integration

### What you need

A **GitLab Personal Access Token** with `api` scope.

**Get one:** gitlab.com/-/user_settings/personal_access_tokens → select `api`

### Config

```json
{
  "token": "glpat-xxxx",
  "webhookSecret": "any-random-string-you-choose"
}
```

### Setting up the GitLab webhook

1. Go to your GitLab project → **Settings → Webhooks → Add new webhook**
2. **URL:** paste the Webhook URL from the integration card
3. **Secret token:** paste your `webhookSecret`
4. **Trigger:** check Push events, Merge request events, etc.
5. Click **Add webhook**

---

## Slack Integration

Send alerts from Provenant (drift detected, policy violated, promotion approved) into a Slack channel.

### What you need

A **Slack Incoming Webhook URL** for your workspace.

**Get one:**
1. Go to api.slack.com/apps → **Create New App → From scratch**
2. Go to **Incoming Webhooks → Activate**
3. Click **Add New Webhook to Workspace** → choose a channel
4. Copy the webhook URL

### Config

```json
{
  "webhookUrl": "https://hooks.slack.com/services/T.../B.../xxx"
}
```

| Field | Description |
|-------|-------------|
| `webhookUrl` | The Incoming Webhook URL from Slack |

### What Provenant can send to Slack

- 🚨 Critical drift detected for agent X
- ⚠️ Policy violation: HIGH severity on agent Y
- ✅ Eval run passed (98% pass rate) on agent Z
- 🚀 Agent version promoted to Production

> Slack notification sending is configured via the API or webhook processor. The integration stores your credentials securely.

---

## Generic Webhook

Use this to connect Provenant to any HTTP service — your own backend, Zapier, n8n, Make, etc.

### Config

```json
{
  "webhookSecret": "any-random-string"
}
```

### Your webhook URL

After creating the integration, your endpoint is:

```
POST http://localhost:4000/api/integrations/webhook/{integrationId}
```

Point any service at this URL to start receiving events in Provenant.

---

## Viewing Webhook Events

Every incoming webhook is stored as an event. To view them:

1. Go to **Integrations** in the sidebar
2. Click the integration card
3. Scroll to **Recent Events** — last 50 events with type, status, and timestamp

### Event statuses

| Status | Meaning |
|--------|---------|
| `RECEIVED` | Payload received and stored |
| `PROCESSING` | Being handled asynchronously |
| `PROCESSED` | Successfully handled ✅ |
| `FAILED` | Processing failed (error recorded) |

---

## Security

- **Token/secret masking** — any config key with `token` or `secret` in the name is shown as `***` in the UI
- **Webhook endpoint is public** — no auth token required (GitHub/GitLab can't send auth headers). Validate the `X-Hub-Signature-256` header from GitHub for extra security
- **Secrets in Configs** — for production, store sensitive values in [Configs & Secrets](06-configs.md) instead of the integration JSON

---

## Deactivating an Integration

```bash
PATCH /api/integrations/:id
Authorization: Bearer <token>

{ "isActive": false }
```

When `isActive = false`, the webhook endpoint returns 404 and stops accepting events.

---

→ Next: [Claude Code Hooks](19-claude-code-hooks.md)
