# Agents

Agents are the central entity in Provenant. Every AI agent your team builds gets registered here, with full version history and lifecycle management.

---

## Creating an Agent

1. Click **Agents** in the sidebar
2. Click **New Agent**
3. Fill in the form:

| Field | Required | Description |
|-------|----------|-------------|
| Name | ✅ | Human-readable name (e.g. `Customer Support Bot`) |
| Slug | ✅ | URL-safe identifier — lowercase, hyphens only (e.g. `customer-support-bot`). Must be unique in your org. |
| Description | — | What the agent does |
| Model family | — | Label for the model type (e.g. `gpt-4`, `claude-3`) |
| Tags | — | Comma-separated tags for filtering |

4. Click **Create**

---

## Agent List

The agents list shows all active agents with:
- Name, slug, and description
- Model family badge
- Tags
- Number of versions
- Last updated time

Use the **search/filter** to narrow down by name or tag.

---

## Agent Detail Page

Click any agent to open its detail page. You'll see:

### Stats Bar
- Total versions, sessions, and eval runs

### Versions Tab
A table of all versions with:
- Semver number
- Status badge (`DRAFT`, `PUBLISHED`, `DEPRECATED`)
- Published/deprecated dates
- Actions: **Publish** or **Deprecate**

### Creating a Version

Click **New Version** from the agent detail page:

| Field | Description |
|-------|-------------|
| Version label | Free-text label (e.g. `v2 with tools`) |
| Semver | Semantic version — must follow `X.Y.Z` format (e.g. `1.0.0`) |
| Changelog | What changed in this version |
| System prompt | The full system prompt sent to the model |
| Model ID | Specific model identifier (e.g. `gpt-4o-2024-11-20`) |
| Parameters | JSON object of model params: `{ "temperature": 0.7, "max_tokens": 2048 }` |
| Tools | JSON array of tool definitions |

---

## Version Lifecycle

```
DRAFT  →  PUBLISHED  →  DEPRECATED
```

| Status | Meaning | Can promote? |
|--------|---------|-------------|
| `DRAFT` | Work in progress | No |
| `PUBLISHED` | Ready for use | Yes |
| `DEPRECATED` | No longer recommended | No |

### Publishing a Version
Click **Publish** on a `DRAFT` version. This makes it available for environment promotions and eval runs.

### Deprecating a Version
Click **Deprecate** on a `PUBLISHED` version. Existing deployments continue to work but no new promotions can be created.

---

## Archiving an Agent

Click **Archive** on an agent to soft-delete it. Archived agents are hidden from the default list but their data (versions, sessions, evals) is preserved. To filter archived agents, use the status filter.

---

## Tips

- **Slugs are permanent** — choose carefully. They appear in API URLs.
- **Versions are immutable** — once published, the system prompt and parameters are frozen. Create a new version for any change.
- **Tags** help when you have many agents — use tags like `customer-facing`, `internal`, `prod-ready`.
