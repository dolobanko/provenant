# CI/CD & GitHub Actions

Provenant's **Eval Gate** blocks deployments and merges when your agent's eval pass rate drops below a defined threshold. It integrates natively with GitHub Actions.

---

## How the eval gate works

```
Push / PR → GitHub Actions → Create eval run → Poll until complete → Check pass rate → ✅ merge / ❌ block
```

1. Your CI pipeline creates an eval run via the Provenant API
2. The action polls until the run reaches `COMPLETED` or `FAILED`
3. If `passRate < min_pass_rate`, the step exits with code 1 — blocking the workflow

---

## Option A: Reusable workflow (recommended)

Use this if your organization maintains Provenant as a shared platform. Call the reusable workflow from any repo's workflow file.

### Setup (once)

Add your API key as a GitHub Actions secret in your repository:
- **Settings → Secrets and variables → Actions → New repository secret**
- Name: `PROVENANT_API_KEY`
- Value: your `pk_live_...` key

Add the Provenant URL as a variable:
- Name: `PROVENANT_URL`
- Value: e.g. `https://api.yourcompany.com`

### Usage

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  eval-gate:
    uses: your-org/provenant/.github/workflows/eval-gate.yml@main
    with:
      api_url:       ${{ vars.PROVENANT_URL }}
      suite_id:      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      agent_id:      'my-support-bot-id'
      min_pass_rate: '0.85'    # fail if < 85% pass rate
      timeout_seconds: '300'
    secrets:
      api_key: ${{ secrets.PROVENANT_API_KEY }}

  deploy:
    needs: eval-gate          # only runs if eval-gate succeeds
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/deploy.sh
```

---

## Option B: Composite action

Use this for a simpler setup or when you want outputs (run ID, pass rate) in subsequent steps.

```yaml
# .github/workflows/pr-check.yml
name: PR Quality Check

on:
  pull_request:
    branches: [main]

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run eval gate
        id: eval
        uses: your-org/provenant/.github/workflows/eval-gate-action@main
        with:
          api_url:          ${{ vars.PROVENANT_URL }}
          api_key:          ${{ secrets.PROVENANT_API_KEY }}
          suite_id:         'a1b2c3d4-...'
          agent_id:         'my-support-bot-id'
          agent_version_id: ${{ github.sha }}   # optional — tag this run with the commit
          min_pass_rate:    '0.80'

      - name: Report result
        if: always()
        run: |
          echo "Eval run ID: ${{ steps.eval.outputs.run_id }}"
          echo "Pass rate:   ${{ steps.eval.outputs.pass_rate }}"
```

---

## Input reference

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api_url` | ✅ | — | Base URL of your Provenant API |
| `api_key` | ✅ | — | `pk_live_...` API key (pass as secret) |
| `suite_id` | ✅ | — | UUID of the eval suite to run |
| `agent_id` | ✅ | — | UUID of the agent to evaluate |
| `agent_version_id` | ❌ | — | UUID of the specific agent version |
| `environment_id` | ❌ | — | UUID of the environment to run against |
| `min_pass_rate` | ❌ | `0.8` | Minimum pass rate (0–1) to pass the gate |
| `poll_interval_seconds` | ❌ | `5` | Seconds between status polls |
| `timeout_seconds` | ❌ | `300` | Max seconds to wait before failing |

## Output reference

| Output | Description |
|--------|-------------|
| `run_id` | UUID of the created eval run |
| `pass_rate` | Final pass rate as a decimal (e.g. `0.92`) |

---

## Practical patterns

### Gate on a specific version

Tag each eval run with the Git SHA so you can trace results back to a commit:

```yaml
with:
  agent_version_id: ${{ github.sha }}
```

### Different thresholds per environment

Use stricter thresholds for production:

```yaml
# staging deployment
min_pass_rate: '0.75'

# production deployment
min_pass_rate: '0.90'
```

### Notify on failure

```yaml
- name: Notify Slack on eval failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {"text": "⚠️ Eval gate failed on `${{ github.ref_name }}` — pass rate: ${{ steps.eval.outputs.pass_rate }}"}
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Troubleshooting eval gate failures

**`401 Unauthorized`**
- Verify `PROVENANT_API_KEY` is set correctly in GitHub Secrets
- Check the key hasn't expired or been revoked

**`404 Not Found` on suite or agent**
- Double-check the `suite_id` and `agent_id` UUIDs
- Ensure the API key belongs to a user with access to those resources

**Run stays in `RUNNING` indefinitely**
- Default timeout is 5 minutes; increase `timeout_seconds` for long-running suites
- Check your eval runner is processing the queue (see [Troubleshooting](18-troubleshooting.md))

**Pass rate below threshold**
- View the run in the Provenant dashboard for individual case results
- Check which cases are failing and update your agent or adjust test expectations

---

## Viewing CI eval runs in the dashboard

Every eval run triggered from CI appears in **Evaluations → Recent Runs** with the agent version and timestamp. Click **View →** to inspect individual case results, score distribution, and estimated cost.
