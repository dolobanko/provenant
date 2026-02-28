/**
 * Provenant — Background Service Worker
 *
 * Receives PROVENANT_TURN messages from the bridge and:
 *   1. Groups turns by ChatGPT conversation ID into Provenant sessions
 *   2. Creates sessions lazily on first turn
 *   3. Records USER + ASSISTANT turns
 *   4. Ends sessions when the tab navigates away from a conversation
 */

// In-memory map: conversationId → provenantSessionId
const sessionMap = {};

// ── Config ─────────────────────────────────────────────────────────────────
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiKey', 'agentId', 'baseUrl'], resolve);
  });
}

// ── API ─────────────────────────────────────────────────────────────────────
async function apiCall(config, method, urlPath, body) {
  const base = config.baseUrl || 'http://localhost:4000';
  const url = new URL(urlPath, base).toString();
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Message handler ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'PROVENANT_TURN') return;
  handleTurn(message.payload).catch(console.error);
  sendResponse({ ok: true });
  return true;
});

async function handleTurn({ conversationId, userMessage, assistantMessage, timestamp }) {
  const config = await getConfig();
  if (!config.apiKey || !config.agentId) return; // Not configured

  const key = conversationId || 'default';

  // Lazily create a Provenant session for this ChatGPT conversation
  if (!sessionMap[key]) {
    try {
      const session = await apiCall(config, 'POST', '/api/sessions', {
        agentId: config.agentId,
        metadata: { source: 'chatgpt', conversationId },
      });
      sessionMap[key] = session.id;
    } catch (err) {
      console.error('[provenant] session create failed', err);
      return;
    }
  }

  const sessionId = sessionMap[key];
  const latencyMs = Date.now() - timestamp;

  // Record USER turn
  if (userMessage) {
    await apiCall(config, 'POST', `/api/sessions/${sessionId}/turns`, {
      role: 'USER',
      content: userMessage,
    }).catch(console.error);
  }

  // Record ASSISTANT turn
  if (assistantMessage) {
    await apiCall(config, 'POST', `/api/sessions/${sessionId}/turns`, {
      role: 'ASSISTANT',
      content: assistantMessage,
      latencyMs,
    }).catch(console.error);
  }
}

// ── End session when tab navigates away ─────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;
  if (tab.url?.includes('chatgpt.com/c/')) return; // still in a conversation

  // Tab navigated away — end all open sessions
  const config = await getConfig();
  for (const [key, sessionId] of Object.entries(sessionMap)) {
    apiCall(config, 'POST', `/api/sessions/${sessionId}/end`, {}).catch(() => {});
    delete sessionMap[key];
  }
});
