# Promotions

A **Promotion** moves a specific agent version from one environment to another — like a deployment pipeline. Promotions are the audit trail for "what is running where and who approved it."

---

## How Promotions Work

```
[Dev] AgentVersion 1.2.0 (PUBLISHED)
         │
         ▼  Create Promotion
[Staging] ──── requiresApproval=true ───► AWAITING_APPROVAL
                                                │
                                          Team member reviews
                                                │
                              ┌─────────────────┴────────────────┐
                          APPROVE                             REJECT
                              │
                              ▼
                           PROMOTED ✅
```

---

## Creating a Promotion

1. Click **Promotions** in the sidebar
2. Click **New Promotion**
3. Fill in:

| Field | Required | Description |
|-------|----------|-------------|
| Agent Version | ✅ | Select a `PUBLISHED` version to promote |
| From Environment | — | Where it's being promoted from (informational) |
| To Environment | ✅ | The target environment |
| Notes | — | Reason for the promotion, JIRA ticket, etc. |

4. Click **Promote**

If the target environment does **not** require approval, the promotion immediately moves to `PENDING` then completes. If it **does** require approval, it sits at `AWAITING_APPROVAL`.

---

## Promotion Statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | Submitted, processing |
| `AWAITING_APPROVAL` | Waiting for a team member to review |
| `PROMOTED` | Successfully promoted ✅ |
| `REJECTED` | Rejected by a reviewer ❌ |

---

## Approving or Rejecting a Promotion

1. Go to **Promotions**
2. Find a promotion with status `AWAITING_APPROVAL`
3. Click **Approve** or **Reject**
4. Optionally add a **comment** explaining your decision
5. Submit

The comment and decision are recorded in the **AuditLog** for compliance.

---

## Promotion List

The promotions list shows all promotions across your organization:

- Agent name + version semver
- From → To environment
- Who triggered it (user)
- Status badge
- Creation date
- Approval decisions with reviewer names

---

## Best Practices

- **Always promote through staging first** — don't skip staging for production.
- **Write meaningful notes** — "Fixes ticket JIRA-1234, increased temperature to 0.8" is far more useful than "update".
- **Check eval results** before promoting — run an eval on the version first and make sure pass rate meets your threshold.
- **Use the audit log** to trace who approved what and when for compliance reviews.
