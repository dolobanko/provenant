# Authentication & API Keys

Provenant supports two authentication methods: **JWT tokens** (for browser sessions) and **API keys** (for SDK and CI/CD integrations).

---

## JWT Authentication

When you sign in via the dashboard, Provenant issues a short-lived JWT stored in `localStorage`. All browser-based API calls use this token automatically. JWTs expire after **7 days** and cannot be revoked individually — sign out to clear them.

---

## API Keys

API keys are permanent, revocable tokens for use with the TypeScript/Python SDKs and CI/CD pipelines. They follow the format:

```
pk_live_<32 hex chars>
```

For example:
```
pk_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

### How keys are stored

Provenant stores a **SHA-256 hash** of your key — the plaintext value is never persisted. This means:

- The full key is shown **only once**, immediately after creation
- Copy and store it securely (a password manager or secret vault)
- If you lose it, revoke the key and generate a new one

---

## Creating an API Key

1. Navigate to **API Keys** in the sidebar
2. Click **New Key**
3. Enter a descriptive name (e.g. `prod-ingestion`, `github-actions-ci`)
4. Optionally set an expiry date
5. Click **Create** — copy the key from the green banner immediately

![API Keys page screenshot](https://placehold.co/800x300/1f2937/6b7280?text=API+Keys+page)

---

## Using API Keys

Pass the key as a Bearer token in the `Authorization` header:

```bash
curl https://your-provenant-api.com/api/agents \
  -H "Authorization: Bearer pk_live_a1b2c3d4..."
```

### With the TypeScript SDK

```typescript
import { ProvenantClient } from '@provenant/sdk';

const client = new ProvenantClient({
  baseUrl: process.env.PROVENANT_URL!,
  apiKey:  process.env.PROVENANT_API_KEY!,
});
```

### With the Python SDK

```python
from provenant_sdk import ProvenantClient
import os

client = ProvenantClient(
    base_url=os.environ["PROVENANT_URL"],
    api_key=os.environ["PROVENANT_API_KEY"],
)
```

### Environment variables

Never hardcode API keys. Use environment variables:

| Variable | Description |
|----------|-------------|
| `PROVENANT_URL` | Base URL of your Provenant API (e.g. `https://api.example.com`) |
| `PROVENANT_API_KEY` | Your `pk_live_...` key |

---

## Key Expiration

When creating a key you can set an optional expiry date. Expired keys return `401 Unauthorized`. Rotate keys before expiry by:

1. Creating a new key
2. Updating your environment variable / secret
3. Revoking the old key

---

## Revoking a Key

1. Navigate to **API Keys**
2. Click **Revoke** next to the key
3. The key is immediately deactivated — all requests using it will receive `401`

> **Note:** Revoking is permanent. There is no "re-activate" option.

---

## Security Best Practices

- **Rotate keys regularly** — every 90 days is a sensible default
- **Use separate keys per environment** — one for local dev, one for staging, one for production
- **Never commit keys to source code** — use `.env` files (gitignored) or a secrets manager
- **Set expiry dates on CI keys** — shorter-lived keys reduce blast radius if leaked
- **Monitor `lastUsedAt`** — keys that have never been used may indicate a configuration error

---

## Key Permissions

API keys inherit the permissions of the user who created them. A key created by an `OWNER` can perform any action. A key created by a `VIEWER` can only read data. See [Team Management](15-team-management.md) for role details.
