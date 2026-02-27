# Policies

Policies are governance rules that define how your agents should behave and what constraints must be met before deployments happen. They provide a codified, auditable layer of control over your AI agents.

---

## Policy Types

| Type | Purpose |
|------|---------|
| `DEPLOYMENT` | Gate promotions — e.g. require eval pass rate ≥ 90% |
| `CONTENT` | Filter outputs — e.g. block PII, hate speech |
| `RATE_LIMIT` | Throttle agent usage — e.g. max 1000 calls/hour per user |
| `DATA_PRIVACY` | Control what data the agent can access or return |
| `APPROVAL` | Require human sign-off for specific actions |

---

## Enforcement Levels

| Level | What Happens |
|-------|-------------|
| `WARN` | Log the violation, let the action proceed |
| `BLOCK` | Prevent the action from completing |
| `NOTIFY` | Send a notification (Slack, webhook) but allow the action |

---

## Creating a Policy

1. Click **Policies** in the sidebar
2. Click **New Policy**
3. Fill in:

| Field | Required | Description |
|-------|----------|-------------|
| Name | ✅ | e.g. `Require 90% Pass Rate for Production` |
| Description | — | What this policy enforces and why |
| Type | ✅ | Select from the types above |
| Enforcement Level | ✅ | `WARN`, `BLOCK`, or `NOTIFY` |
| Rules | ✅ | JSON array of rule definitions |
| Enabled | — | Toggle to activate/deactivate without deleting |

4. Click **Create**

---

## Rules Format

The `rules` field is a JSON array. Each rule object defines a condition:

```json
[
  {
    "id": "min-pass-rate",
    "condition": "evalPassRate >= 0.90",
    "message": "Agent must pass at least 90% of eval cases before promoting to production"
  },
  {
    "id": "no-pii-in-output",
    "condition": "!containsPII(output)",
    "message": "Agent output must not contain personally identifiable information"
  }
]
```

> Rules are stored as JSON. The `/api/policies/evaluate` endpoint runs them against a resource. Custom rule execution logic is implemented in your agent's backend or via an external rules engine.

---

## Evaluating a Policy

Call the evaluate endpoint to check a resource against all active policies:

```bash
POST /api/policies/evaluate
Authorization: Bearer <token>
Content-Type: application/json

{
  "resourceType": "AgentVersion",
  "resourceId": "version-uuid-here",
  "context": {
    "evalPassRate": 0.95,
    "targetEnvironment": "production"
  }
}
```

Response:
```json
{
  "resourceType": "AgentVersion",
  "resourceId": "version-uuid-here",
  "allPassed": true,
  "results": [
    {
      "policyId": "policy-uuid",
      "policyName": "Require 90% Pass Rate for Production",
      "type": "DEPLOYMENT",
      "enforcementLevel": "BLOCK",
      "passed": true,
      "details": {}
    }
  ]
}
```

---

## Recording a Violation

When your system detects a policy breach, record it:

```bash
POST /api/policies/violations
Authorization: Bearer <token>
Content-Type: application/json

{
  "policyId": "policy-uuid",
  "resourceId": "version-or-session-uuid",
  "resourceType": "AgentVersion",
  "severity": "HIGH",
  "details": {
    "evalPassRate": 0.72,
    "threshold": 0.90,
    "blockedPromotion": true
  }
}
```

Violations appear in the **Policies** page under the policy, and the count shows on the Dashboard.

---

## Resolving a Violation

1. Go to **Policies** → click on the policy
2. Find the unresolved violation
3. Click **Resolve**

The violation is marked as resolved with a timestamp. Resolution is tracked in the audit log.

---

## Policy Detail Page

Click any policy to see:
- Policy settings and rules
- **Violation history** — last 20 violations with severity, resource, and status
- Toggle to enable/disable without deleting

---

## Best Practices

- **Start with `WARN`** — get visibility before you start blocking. Review violations weekly.
- **Use `DEPLOYMENT` policies** to enforce eval gates — "don't promote to prod with pass rate < 95%."
- **Use `CONTENT` policies** for safety — even if enforcement is `WARN`, you'll know when outputs are concerning.
- **Name violations clearly** — the `details` JSON will be your first stop when investigating an incident.
- **Pair with Slack integration** — set `NOTIFY` enforcement so your team gets an immediate alert on violations.
