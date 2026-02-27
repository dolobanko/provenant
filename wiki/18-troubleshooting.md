# Troubleshooting & FAQ

---

## Common HTTP Errors

| Code | Error | Likely cause | Fix |
|------|-------|--------------|-----|
| `400` | Bad Request | Missing required field or invalid data format | Check the request body matches the API schema |
| `401` | Unauthorized | Missing, expired, or revoked token | Re-login or generate a new API key |
| `403` | Forbidden | Your role doesn't allow this action | Check your role in **Team**; ask an OWNER/ADMIN |
| `404` | Not Found | Resource doesn't exist or belongs to another org | Verify the UUID is correct and in your org |
| `409` | Conflict | Duplicate resource (e.g. org slug taken) | Choose a different slug or name |
| `422` | Unprocessable Entity | Validation error | Read the `error` field in the response |
| `500` | Internal Server Error | Bug or unhandled exception | Check API server logs; file an issue |

---

## Authentication Issues

### "Invalid or expired API key"

1. Verify the key starts with `pk_live_`
2. Check if the key has been revoked (go to **API Keys** — if it's not listed, it was revoked)
3. Check if the key has an expiry date that has passed
4. Make sure you're passing it as `Authorization: Bearer pk_live_...` (include `Bearer `)

### "JWT expired"

Your browser session has expired. Sign out and sign back in. JWTs are valid for 7 days.

### API key was created but API returns 401

- Ensure you're hitting the correct `PROVENANT_URL` — a staging key won't work against a production API
- The key hash is computed at creation time; if the key was copied incorrectly it will never match

---

## Sessions Not Appearing

**SDK sessions not showing in the dashboard**

1. Confirm `PROVENANT_URL` points to your running API (not localhost from inside a container)
2. Verify the `agentId` exists in your org — create it in **Agents** first
3. Check that `client.sessions.end()` / `client.end_session()` is being called — sessions without an `endedAt` are valid but may sort differently
4. Look at the API logs: `tsx watch src/index.ts` output should show `POST /api/sessions`

**Sessions appear but turns are missing**

- Each turn is a separate `POST /api/sessions/:id/turns` call
- Ensure your SDK `addTurn()` / `add_turn()` calls are `await`ed (TypeScript) or not inside a fire-and-forget pattern

---

## Eval Runs Stuck in RUNNING

1. **No results submitted** — if you created the run manually, call `POST /evals/runs/:id/results` to submit case results and complete the run
2. **Results submitted but status unchanged** — check that the `runId` in your results matches the run you created
3. **`waitForCompletion` timeout** — increase `timeoutMs` / `timeout_seconds`; the default is 5 minutes

---

## Drift Not Detected

**Drift report shows no changes despite prompt update**

- Drift is calculated against a **baseline** agent version — make sure a baseline is set for the agent
- If both versions have identical system prompts, drift score will be 0 (expected)
- Low-severity drift (score < threshold) may not create a report depending on your config

**Baseline not found**

- Go to **Agents → [agent] → Versions** and publish at least one version as a baseline
- Drift reports require at least two versions to compare

---

## Analytics Charts Empty

The dashboard analytics charts (Eval Pass Rate, Session Volume, Drift by Severity) show **No data yet** until:

- At least one session has been created (Session Volume)
- At least one COMPLETED eval run exists (Eval Pass Rate)
- At least one drift report has been generated (Drift by Severity)

Create test data via the SDK or the dashboard to populate the charts.

---

## Cost Tracking Shows "—"

The cost estimate uses a built-in model pricing table. `—` appears when:

- No `modelId` is set on the agent version
- The model ID doesn't match any known pricing entry

**Fix:** When creating/updating an agent version, set the `modelId` field to a recognized value such as `claude-sonnet-4`, `gpt-4o`, or `gemini-1.5-pro`. Prefix matching is used, so `claude-sonnet-4-20251022` will match `claude-sonnet-4`.

---

## Import Template Has No Effect

If importing a template appears to succeed but no cases appear in the suite:

1. Verify the suite UUID in the URL is correct
2. Refresh the page — the case count updates after the mutation invalidates the query cache
3. Check for a `409 Conflict` in the network tab — some templates may guard against duplicate imports

---

## Frequently Asked Questions

### Can I have multiple organizations?

Not yet. Each user account belongs to exactly one organization. Multi-org support is on the roadmap.

### How long are sessions retained?

Sessions are retained indefinitely by default (SQLite / PostgreSQL storage). You are responsible for data retention policies on your self-hosted instance.

### Can I self-host Provenant?

Yes — the full stack (API + web) is open source and designed for self-hosting. See the [Getting Started guide](01-getting-started.md) for setup instructions.

### What models are supported for cost tracking?

Built-in pricing is included for:

| Model family | Examples |
|--------------|---------|
| Claude 4.x | `claude-opus-4`, `claude-sonnet-4`, `claude-haiku-4` |
| Claude 3.x | `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-opus` |
| GPT-4o | `gpt-4o`, `gpt-4o-mini` |
| GPT-4 | `gpt-4-turbo`, `gpt-4` |
| Gemini | `gemini-1.5-pro`, `gemini-1.5-flash` |

For unsupported models the cost column shows `—`. You can extend the pricing table in `apps/api/src/lib/pricing.ts`.

### Why is my invite link not working?

- Invite links expire after 7 days — generate a new one
- The link includes a UUID token; make sure it wasn't truncated when copying
- Check that the invitee is using the correct Provenant instance URL

### Is there a rate limit on the API?

There is no enforced rate limit by default on self-hosted deployments. You can configure rate-limit policies per agent via the [Policy Engine](11-policies.md).

### How do I reset my password?

Password reset is not yet implemented in the UI. As a workaround, an OWNER can remove and re-invite the user to regenerate credentials.

---

## Getting More Help

- Open the developer console (`F12`) and check for JavaScript errors
- Check the API server terminal output for stack traces
- Review the [API Reference](13-api-reference.md) for expected request/response shapes
- File an issue on GitHub with the error message and steps to reproduce
