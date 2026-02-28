/**
 * Provenant — ChatGPT Content Script
 *
 * Runs in MAIN world (same JS context as ChatGPT's frontend code) so it can
 * patch window.fetch and intercept streaming API responses.
 *
 * Flow:
 *   1. User sends a message → ChatGPT calls /backend-api/conversation
 *   2. We intercept the request body (user message)
 *   3. We read the SSE stream and reassemble the assistant reply
 *   4. We dispatch a CustomEvent so the background service worker (via
 *      chrome.runtime.sendMessage relay in the content bridge) can forward
 *      the turn to Provenant.
 */

(function () {
  'use strict';

  const TARGET_PATH = '/backend-api/conversation';

  // ── SSE parser ─────────────────────────────────────────────────────────────
  function parseSSEChunks(text) {
    const lines = text.split('\n');
    let assembled = '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      try {
        const json = JSON.parse(data);
        // ChatGPT streaming format
        const delta = json?.message?.content?.parts?.[0] ?? json?.choices?.[0]?.delta?.content ?? '';
        if (typeof delta === 'string') assembled += delta;
      } catch {}
    }
    return assembled;
  }

  // ── Patch fetch ────────────────────────────────────────────────────────────
  const _fetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input?.url ?? '';

    // Only intercept ChatGPT conversation endpoint
    if (!url.includes(TARGET_PATH)) {
      return _fetch(input, init);
    }

    // Extract user message from request body
    let userMessage = '';
    let conversationId = null;
    try {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      conversationId = body.conversation_id || null;
      const parts = body?.messages?.[body.messages.length - 1]?.content?.parts;
      userMessage = Array.isArray(parts) ? parts.join('') : '';
    } catch {}

    const response = await _fetch(input, init);

    // Clone response so we can read the stream without consuming it
    const [forBrowser, forUs] = response.body
      ? [response.clone(), response.clone()]
      : [response, response];

    // Read our copy in the background
    ;(async () => {
      try {
        const reader = forUs.body.getReader();
        const decoder = new TextDecoder();
        let raw = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
        }
        const assistantMessage = parseSSEChunks(raw);

        // Emit event that our background bridge can pick up
        window.dispatchEvent(new CustomEvent('__provenant_turn__', {
          detail: {
            conversationId,
            userMessage,
            assistantMessage,
            timestamp: Date.now(),
          }
        }));
      } catch {}
    })();

    return forBrowser;
  };

  // ── Bridge to background service worker ────────────────────────────────────
  window.addEventListener('__provenant_turn__', (e) => {
    // CustomEvents can't cross to the extension context directly, so we use
    // a tiny bridge: inject an attribute on <html> and watch it in the
    // isolated-world content bridge (bridge.js).
    const el = document.documentElement;
    el.setAttribute('data-provenant-turn', JSON.stringify(e.detail));
  });
})();
