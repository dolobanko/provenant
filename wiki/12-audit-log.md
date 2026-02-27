# Audit Log

The Audit Log is an immutable record of every action taken in Provenant. It answers the compliance question: **"Who did what, to what, and when?"**

---

## What Gets Logged

Every API mutation (create, update, delete) is automatically recorded:

| Action | What it tracks |
|--------|---------------|
| `agent.create` | New agent created |
| `agent.update` | Agent name/slug/tags changed |
| `agent.archive` | Agent archived |
| `version.create` | New agent version created |
| `version.publish` | Version published |
| `version.deprecate` | Version deprecated |
| `environment.create` | New environment created |
| `environment.update` | Environment settings changed |
| `promotion.create` | Promotion initiated |
| `promotion.approve` | Promotion approved |
| `promotion.reject` | Promotion rejected |
| `config.upsert` | Agent config created or updated |
| `config.secret.set` | Secret key written |
| `config.secret.delete` | Secret key deleted |
| `eval.suite.create/update/delete` | Eval suite changes |
| `eval.case.create/update/delete` | Eval case changes |
| `eval.run.create` | Eval run started |
| `drift.report` | Drift report recorded |
| `drift.baseline.create` | Baseline set |
| `session.create` | Session started |
| `session.end` | Session ended |
| `integration.create/update/delete` | Integration changes |
| `policy.create/update/delete` | Policy changes |
| `policy.violation` | Violation recorded |
| `policy.violation.resolve` | Violation resolved |

---

## Each Log Entry Contains

| Field | Description |
|-------|-------------|
| **Action** | What happened (e.g. `agent.create`) |
| **Resource Type** | What was affected (e.g. `Agent`) |
| **Resource ID** | UUID of the specific record |
| **User** | Who did it (name + email) |
| **Before** | State before the change (JSON) |
| **After** | State after the change (JSON) |
| **IP Address** | Source IP |
| **User Agent** | Browser/client info |
| **Timestamp** | When it happened |

---

## Browsing the Audit Log

1. Click **Audit Log** in the sidebar
2. Use the filters to narrow results:

| Filter | Description |
|--------|-------------|
| User | Filter by specific user |
| Action | Filter by action name (supports partial match) |
| Resource Type | e.g. `Agent`, `AgentVersion` |
| Resource ID | Specific record UUID |
| From / To | Date range |
| Limit | Max results (default 50, max 200) |

3. Results are paginated and sortable by timestamp (newest first)

---

## Audit Stats

Click the **Stats** tab to see aggregated breakdowns:
- **By Action** — top 10 most frequent actions
- **By Resource Type** — which entity types are changed most
- **By User** — top 5 most active users

Useful for spotting unusual activity spikes.

---

## Exporting Logs (Compliance)

Export the full audit log as **NDJSON** (Newline-Delimited JSON) for:
- Feeding into SIEM systems (Splunk, Datadog, etc.)
- Storing in cold storage for compliance retention
- Manual review in Excel/Python

```bash
GET /api/audit/export?from=2025-01-01&to=2025-12-31
Authorization: Bearer <token>
```

Response is streamed as `application/x-ndjson` with each line being one log entry:
```json
{"id":"...","action":"agent.create","resourceType":"Agent","userId":"...","createdAt":"2025-06-01T10:00:00Z",...}
{"id":"...","action":"version.publish","resourceType":"AgentVersion","userId":"...","createdAt":"2025-06-02T09:30:00Z",...}
```

Use the **Export** button in the UI to trigger a browser download.

---

## Searching for a Specific Change

**Scenario: "Who changed the production agent config last Tuesday?"**

1. Go to **Audit Log**
2. Set **Action** filter to `config`
3. Set **Date range** to last Tuesday
4. Look for `config.upsert` entries — click through to see the Before/After diff

---

## Compliance Considerations

- Audit logs are **append-only** — no UI or API endpoint allows editing or deleting them
- Logs include **IP address** for each action — useful for access control audits
- **Before/After** state captures make it possible to reconstruct what changed without reading application code
- For GDPR/SOC2 audits, export logs for the relevant time period and demonstrate the chain of approvals for any production change

---

## Tips

- **Set up log retention early** — plan for where exported NDJSON files go (S3, etc.) before you need them for compliance
- **Review audit stats weekly** — sudden spikes in `config.upsert` or `policy.violation` deserve investigation
- **Correlate with sessions** — when a user reports unusual agent behavior, find the session, find the config that was active at that time, and trace any recent changes in the audit log
