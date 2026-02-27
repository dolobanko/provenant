# Configs

A **Config** stores the runtime settings for a specific agent in a specific environment. This separates your agent's *identity* (version) from its *behavior* (config) — so you can tune parameters per environment without cutting a new version.

---

## What Goes in a Config?

| Field | Type | Example |
|-------|------|---------|
| `config` | JSON object | Model params, feature flags, thresholds |
| `overrides` | JSON object | Values that take precedence over defaults |
| Secrets | Key-value pairs | API keys, database URLs, auth tokens |

**Example `config`:**
```json
{
  "temperature": 0.7,
  "max_tokens": 1024,
  "system_prompt_override": null,
  "fallback_enabled": true,
  "log_level": "info"
}
```

**Example `overrides`:**
```json
{
  "temperature": 0.3,
  "log_level": "debug"
}
```

---

## Creating or Updating a Config

Configs use **upsert semantics** — you either create a new config or replace the existing one for that agent+environment pair.

1. Click **Configs** in the sidebar
2. Click **New Config** (or **Edit** on an existing one)
3. Select:
   - **Agent** — which agent to configure
   - **Environment** — which environment this config applies to
4. Fill in the **Config JSON** and **Overrides JSON** fields
5. Click **Save**

If a config already exists for that agent+environment pair, it will be updated in place.

---

## Secrets

Secrets are write-only — once stored, the value is never shown again. Only the **key name** is listed. This makes them safe for:

- External API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- Database connection strings
- Webhook signing secrets
- OAuth tokens

### Adding a Secret

1. Open a config
2. Click **Add Secret**
3. Enter the **Key** (e.g. `OPENAI_API_KEY`) and **Value**
4. Click **Save**

The value is stored and the key appears in the secrets list. If you add a secret with the same key again, it **overwrites** the previous value.

### Deleting a Secret

Click the **trash icon** next to a secret key to remove it.

---

## Config Inheritance

The `Inherit From` field (optional) lets you point to another config to inherit base values from. This is useful for having a "base" config shared across environments, with per-environment overrides on top.

---

## Config List

The configs list shows all configs with:
- Agent name
- Environment name
- Last updated timestamp
- Number of secrets stored

---

## How the Config Reaches Your Agent

Configs are managed by Provenant but consumed by your agent code. Fetch the config at agent startup via the API:

```bash
GET /api/configs?agentId=<id>&environmentId=<id>
Authorization: Bearer <token>
```

Response includes the `config` and `overrides` objects. Apply overrides on top of config in your agent runtime.

---

## Best Practices

- **Don't put secrets in the `config` JSON** — use the Secrets feature. Secrets are stored securely; config JSON is visible in plaintext.
- **Keep production configs conservative** — lower temperature, stricter limits.
- **Use `overrides` for emergency adjustments** — you can hot-patch behavior without touching the base config.
