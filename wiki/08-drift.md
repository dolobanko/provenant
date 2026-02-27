# Drift Detection

Drift Detection monitors whether your agent's behavior has changed over time — even when the code hasn't. Model providers silently update models, system behavior shifts with new training data, or production patterns differ from what you tested. Drift Detection catches this.

---

## How Drift Works

```
Baseline  (known-good eval run metrics)
    │
    │  compare
    ▼
Current Run  (latest eval run)
    │
    ▼
DriftReport  (drift score + severity + dimension breakdown)
```

---

## Setting a Baseline

A **Baseline** is a snapshot of "good" metrics — the standard everything else is measured against.

1. Click **Drift Detection** in the sidebar
2. Click **Set Baseline**
3. Select:
   - **Agent** — which agent
   - **Agent Version** — which version the baseline is for (optional)
   - **Environment** — which environment (optional)
   - **Metrics** — JSON object of the metrics to baseline

**Example metrics JSON:**
```json
{
  "passRate": 0.96,
  "avgScore": 88.4,
  "avgLatencyMs": 1100,
  "avgTokenCount": 320
}
```

Setting a new baseline deactivates the previous one for that agent+environment pair — only one active baseline exists at a time.

---

## Computing Drift

Drift is computed by comparing two eval runs:

1. Click **Compute Drift**
2. Select:
   - **Baseline Run ID** — the reference eval run
   - **Current Run ID** — the run you want to compare
3. The system calculates:

```
driftScore = (|scoreDelta| + |passRateDelta × 100|) / 2
```

| Drift Score | Severity |
|-------------|----------|
| 0–10 | `LOW` |
| 10–25 | `MEDIUM` |
| 25–40 | `HIGH` |
| 40+ | `CRITICAL` |

The result is returned immediately with the full dimension breakdown — you can then save it as a **Drift Report**.

---

## Creating a Drift Report Manually

If you want to record a drift event (from your own monitoring, for example):

1. Click **New Report**
2. Fill in agent, version, environment, and the metrics
3. Enter the drift score and severity
4. Click **Save**

Reports appear in the drift list and on the Dashboard "Open Drifts" counter.

---

## Resolving a Drift Report

Once you've investigated and addressed the drift (e.g. rolled back a version, updated the baseline, contacted the model provider):

1. Find the report in the list
2. Click **Resolve**

The report is marked as resolved and removed from the open drifts count.

---

## Drift Report List

| Column | Description |
|--------|-------------|
| Agent | Which agent drifted |
| Version | Which version was affected |
| Environment | Which environment |
| Drift Score | 0–100 severity score |
| Severity | LOW / MEDIUM / HIGH / CRITICAL |
| Reported | When it was detected |
| Resolved | When it was resolved (or open) |

---

## Automated Drift Monitoring (Production Pattern)

In a production setup, wire this into your CI/CD:

```bash
# After every nightly eval run:
POST /api/drift/compute
{
  "baselineRunId": "run-from-last-week",
  "currentRunId":  "run-from-tonight"
}

# If driftScore > 25, POST /api/drift/reports to record + alert
# If driftScore > 40, page on-call
```

---

## Tips

- **Set a baseline right after a successful production deployment** — that becomes your reference point.
- **Run evals on the same schedule** (e.g. nightly) to get comparable data.
- **Use `CRITICAL` drift as a rollback trigger** — if drift score exceeds 40, consider automatically rolling back to the previous version.
