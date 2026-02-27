# Environments

Environments are deployment targets. They let you run the same agent with different configurations across dev, staging, and production — with approval gates protecting your production environment.

---

## Default Environments

Three environments are created automatically when you register:

| Name | Slug | Type | Requires Approval |
|------|------|------|------------------|
| Development | `development` | `DEVELOPMENT` | No |
| Staging | `staging` | `STAGING` | Yes |
| Production | `production` | `PRODUCTION` | Yes |

---

## Creating a Custom Environment

1. Click **Environments** in the sidebar
2. Click **New Environment**
3. Fill in:

| Field | Required | Description |
|-------|----------|-------------|
| Name | ✅ | Display name (e.g. `Europe Production`) |
| Slug | ✅ | Lowercase, hyphens only (e.g. `europe-prod`) |
| Type | ✅ | `DEVELOPMENT`, `STAGING`, `PRODUCTION`, or `CUSTOM` |
| Description | — | Notes about this environment |
| Requires approval | — | Toggle — if on, promotions into this env need manual approval |

4. Click **Create**

---

## Environment Detail Page

Click any environment to see:
- **Settings** — name, type, approval requirement
- **Agents configured** — which agents have a config in this environment

---

## Approval-Gated Environments

When an environment has **Requires approval** enabled:

1. A promotion is created with status `AWAITING_APPROVAL`
2. A team member with access reviews it in the **Promotions** page
3. They click **Approve** or **Reject** with an optional comment
4. On approval, status changes to `PROMOTED`

This prevents untested code from reaching production accidentally.

---

## Environment Types

| Type | Intended Use |
|------|-------------|
| `DEVELOPMENT` | Local / individual dev work |
| `STAGING` | Pre-production testing, QA |
| `PRODUCTION` | Live traffic |
| `CUSTOM` | Canary, shadow, regional, etc. |

Types are informational — the system treats all environments the same way mechanically, except for the approval requirement.

---

## Next Steps

- [Configure an agent for an environment →](./06-configs.md)
- [Promote an agent version to an environment →](./05-promotions.md)
