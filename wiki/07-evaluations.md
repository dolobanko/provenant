# Evaluations

Evaluations let you systematically test your agent versions before promoting them. Build test suites, run them against any version, and track pass rates and scores over time.

---

## Concepts

```
EvalSuite  (a named collection of tests)
  └── EvalCase  (one test: input + expected output)

EvalRun  (running a suite against a specific agent version)
  └── EvalCaseResult  (pass/fail + score for each case)
```

---

## Creating an Eval Suite

1. Click **Evaluations** in the sidebar
2. Click **New Suite**
3. Fill in:

| Field | Description |
|-------|-------------|
| Name | e.g. `Customer Support Smoke Tests` |
| Description | What this suite tests |
| Tags | e.g. `regression`, `smoke`, `nightly` |

4. Click **Create Suite**

---

## Adding Test Cases

Open a suite and click **Add Case**:

| Field | Required | Description |
|-------|----------|-------------|
| Name | ✅ | e.g. `Handles refund request` |
| Description | — | What behaviour this tests |
| Input | ✅ | JSON object passed to the agent (e.g. `{"message": "I want a refund"}`) |
| Expected Output | — | JSON object representing the ideal response |
| Scoring Function | ✅ | How to score the result (default: `exact_match`) |
| Weight | — | Contribution to the overall score (default: `1.0`) |
| Tags | — | `happy-path`, `edge-case`, etc. |

### Scoring Functions

| Function | Description |
|----------|-------------|
| `exact_match` | Output must exactly match expected |
| `contains` | Output must contain expected string |
| `similarity` | Semantic similarity score (0–1) |
| `custom` | Your own scoring logic via the external results API |

---

## Running an Eval

1. From the suite detail page (or Evaluations list), click **New Run**
2. Select:
   - **Agent** — which agent to evaluate
   - **Agent Version** — which published version to test (optional — defaults to latest)
   - **Environment** — which environment config to use (optional)
3. Click **Start Run**

The run starts immediately:
```
QUEUED → RUNNING → COMPLETED
```

This takes ~2 seconds in the built-in simulation mode. In production you'd wire this to your actual agent invocation system.

---

## Viewing Run Results

Click any run to open the **Eval Run** detail page:

### Summary
| Metric | Description |
|--------|-------------|
| Status | `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED` |
| Pass Rate | % of cases that passed |
| Score | Average score across all cases (0–100) |
| Duration | Time from start to completion |

### Case Results Table
Each row shows:
- Case name
- ✅ / ❌ Pass or Fail
- Score (0–100)
- Latency (ms)
- Token count

---

## Submitting External Results

If your agent runs outside Provenant, you can submit results after the fact:

```bash
POST /api/evals/runs/:runId/results
Authorization: Bearer <token>
Content-Type: application/json

{
  "results": [
    {
      "caseId": "case-uuid-here",
      "passed": true,
      "score": 92.5,
      "latencyMs": 1200,
      "tokenCount": 340,
      "actualOutput": { "response": "Your refund is being processed." },
      "metadata": { "model": "gpt-4o" }
    }
  ]
}
```

This updates the run's aggregate pass rate and score automatically.

---

## Eval History & Trends

The **Evaluations** page shows all runs across all suites:
- Filter by agent or suite
- See pass rate trends over time
- Quickly spot regressions between versions

---

## Best Practices

- **Run evals before every promotion** — make it a required step in your release process.
- **Start small** — even 5 well-chosen test cases catch most regressions.
- **Use weights** — give higher weight to critical cases (e.g. safety checks) so they dominate the overall score.
- **Tag cases** — use `smoke`, `regression`, `edge-case` tags so you can reason about what kinds of tests you have.
- **Set a minimum pass rate threshold** — e.g. refuse to promote if pass rate < 90%.
