# ChatGPT Chrome Extension

The **Provenant ChatGPT Extension** automatically logs your ChatGPT conversations to Provenant. Every message you send and every response you receive is captured as a session — no copy-pasting, no code changes.

---

## How It Works

```
You chat on chatgpt.com
        │
        ▼
Extension intercepts ChatGPT's API calls (fetch patch)
        │
        ▼
Reads the streaming response, reconstructs full messages
        │
        ▼
Sends USER + ASSISTANT turns to Provenant API
        │
        ▼
Session appears in your Provenant dashboard
```

The extension runs entirely in your browser. It uses Chrome's content script system to intercept `window.fetch` calls to ChatGPT's backend, so it captures conversations without any server-side changes.

---

## Installation

### Step 1 — Load the extension in Chrome

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the folder: `packages/extension-chatgpt` (inside the Provenant repo)

You'll see the **Provenant** extension appear in your extensions list.

### Step 2 — Configure the extension

1. Click the Provenant extension icon in the Chrome toolbar (puzzle piece → Provenant)
2. Fill in:

| Field | What to enter |
|-------|--------------|
| **API Key** | Your `pk_live_...` key from Provenant → API Keys |
| **Agent ID** | The UUID of the agent you want sessions logged under |
| **Base URL** | `http://localhost:4000` (the Provenant API) |

3. Click **Save & Test** — you'll see a green ✅ **Connected** status if everything is working

### Step 3 — Chat normally on ChatGPT

Open **chatgpt.com** and have a conversation. The session will appear in Provenant → **Sessions** automatically.

---

## What Gets Logged

| ChatGPT event | What Provenant records |
|---------------|----------------------|
| You send a message | `USER` turn |
| ChatGPT responds | `ASSISTANT` turn |
| New conversation started | New Session created |
| You navigate away from conversation | Session marked `COMPLETED` |

### Example session in Provenant

```
Session: ChatGPT Agent · (no environment)
├── USER       "Can you help me debug this Python function?"
├── ASSISTANT  "Sure! Let me look at the function. The issue is on line 3..."
├── USER       "What about edge cases?"
├── ASSISTANT  "Good question. Here are 3 edge cases to consider..."
└── Session ended · 4 turns
```

---

## Extension Popup

The popup shows your current connection status:

| Status | Meaning |
|--------|---------|
| 🟢 **Connected** | API key valid, sessions are being logged |
| 🔴 **Not configured** | No API key set — click the extension to configure |
| 🟡 **Error** | API unreachable — check that the API server is running |

---

## Technical Details

The extension uses **Manifest V3** with two content scripts:

1. **`content-script.js`** (runs in MAIN world) — patches `window.fetch` on chatgpt.com to intercept API calls to `/backend-api/conversation`. Reads the SSE stream to reconstruct assistant messages.

2. **`bridge.js`** (runs in isolated world) — relays data from the content script to the background service worker via `chrome.runtime.sendMessage`.

3. **`background.js`** (service worker) — manages sessions, maps ChatGPT conversation IDs to Provenant session IDs, and makes API calls to Provenant.

---

## Troubleshooting

**Sessions not appearing in Provenant?**
- Check the extension popup shows 🟢 Connected
- Make sure the Provenant API is running (`curl http://localhost:4000/api/health` or check that `api.log` is active)
- Open Chrome DevTools on chatgpt.com → Console — look for `[Provenant]` log messages

**"Not configured" after entering credentials?**
- Make sure `baseUrl` is `http://localhost:4000` (port 4000, not 5173)
- Make sure the API key belongs to the same org as the agent ID you entered

**Extension not intercepting messages?**
- Go to `chrome://extensions` and click **Reload** on the Provenant extension
- Hard-refresh chatgpt.com (Cmd+Shift+R)

---

## Privacy Note

The extension only runs on `chatgpt.com`. It sends your conversation content to your **local Provenant API** (`http://localhost:4000`) — nothing goes to any external server. Your ChatGPT conversations are only stored in your own local SQLite database.

---

→ Back to: [Integrations](10-integrations.md)
