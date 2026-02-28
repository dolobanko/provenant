const apiKeyEl     = document.getElementById('apiKey');
const agentIdEl    = document.getElementById('agentId');
const baseUrlEl    = document.getElementById('baseUrl');
const saveBtn      = document.getElementById('save');
const statusEl     = document.getElementById('status');
const dot          = document.getElementById('dot');
const indicatorTxt = document.getElementById('indicator-text');

// Load saved config
chrome.storage.sync.get(['apiKey', 'agentId', 'baseUrl'], ({ apiKey, agentId, baseUrl }) => {
  if (apiKey)  apiKeyEl.value  = apiKey;
  if (agentId) agentIdEl.value = agentId;
  baseUrlEl.value = baseUrl || 'http://localhost:4000';

  if (apiKey && agentId) {
    dot.classList.remove('off');
    indicatorTxt.textContent = 'Connected — recording ChatGPT sessions';
  }
});

saveBtn.addEventListener('click', async () => {
  const apiKey  = apiKeyEl.value.trim();
  const agentId = agentIdEl.value.trim();
  const baseUrl = baseUrlEl.value.trim() || 'http://localhost:4000';

  if (!apiKey || !agentId) {
    statusEl.textContent = 'API key and Agent ID are required.';
    statusEl.className = 'status err';
    return;
  }

  // Quick connectivity check
  statusEl.textContent = 'Checking connection…';
  statusEl.className = 'status';
  try {
    const res = await fetch(`${baseUrl}/api/agents/${agentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    statusEl.textContent = `Connection failed: ${err.message}`;
    statusEl.className = 'status err';
    return;
  }

  chrome.storage.sync.set({ apiKey, agentId, baseUrl }, () => {
    dot.classList.remove('off');
    indicatorTxt.textContent = 'Connected — recording ChatGPT sessions';
    statusEl.textContent = 'Saved!';
    statusEl.className = 'status ok';
    setTimeout(() => (statusEl.textContent = ''), 2000);
  });
});
