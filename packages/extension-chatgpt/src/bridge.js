/**
 * Provenant — Isolated-world bridge
 *
 * Runs in the extension's isolated world (different from MAIN world).
 * Watches for the data attribute set by content-script.js and relays
 * the turn payload to the background service worker via chrome.runtime.
 */

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type === 'attributes' && m.attributeName === 'data-provenant-turn') {
      const raw = document.documentElement.getAttribute('data-provenant-turn');
      if (!raw) continue;
      try {
        const detail = JSON.parse(raw);
        chrome.runtime.sendMessage({ type: 'PROVENANT_TURN', payload: detail });
      } catch {}
      document.documentElement.removeAttribute('data-provenant-turn');
    }
  }
});

observer.observe(document.documentElement, { attributes: true });
