#!/usr/bin/env node
/**
 * Provenant — Claude Code Hooks Integration
 *
 * Receives lifecycle events from Claude Code and records them as
 * sessions + turns in the Provenant platform.
 *
 * Hook types handled:
 *   post-tool  — fired after every tool call (Bash, Read, Write, Edit, …)
 *   stop       — fired when the Claude Code session ends
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const CONFIG_FILE = path.join(os.homedir(), '.provenant', 'hooks-config.json');
const SESSION_DIR = path.join(os.tmpdir(), 'provenant-sessions');

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session helpers  (keyed by Claude Code session ID, falls back to PID-tree)
// ---------------------------------------------------------------------------
function sessionFile(key) {
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
  return path.join(SESSION_DIR, `session-${key}.json`);
}

function loadSession(key) {
  try { return JSON.parse(fs.readFileSync(sessionFile(key), 'utf8')); } catch { return null; }
}

function saveSession(key, data) {
  fs.writeFileSync(sessionFile(key), JSON.stringify(data), 'utf8');
}

function clearSession(key) {
  try { fs.unlinkSync(sessionFile(key)); } catch {}
}

// ---------------------------------------------------------------------------
// HTTP helper  (works with http:// and https://)
// ---------------------------------------------------------------------------
function apiCall(config, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const base = config.baseUrl || 'http://localhost:4000';
    const url = new URL(urlPath, base);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const data = JSON.stringify(body);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = lib.request(options, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const hookType = process.argv[2]; // 'post-tool' | 'stop'

  // Read JSON from stdin
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  let event = {};
  try { event = JSON.parse(raw); } catch {}

  const config = loadConfig();
  if (!config) process.exit(0); // not configured — silent no-op

  // Use Claude Code session ID if available, fall back to PPID
  const sessionKey = event.session_id || event.conversation_id || String(process.ppid || 'default');

  // ── STOP ──────────────────────────────────────────────────────────────────
  if (hookType === 'stop') {
    const session = loadSession(sessionKey);
    if (session?.id) {
      try { await apiCall(config, 'POST', `/api/sessions/${session.id}/end`, {}); } catch {}
      clearSession(sessionKey);
    }
    process.exit(0);
  }

  // ── POST-TOOL ─────────────────────────────────────────────────────────────
  if (hookType === 'post-tool') {
    // Get or lazily create a Provenant session
    let session = loadSession(sessionKey);
    if (!session) {
      try {
        session = await apiCall(config, 'POST', '/api/sessions', {
          agentId: config.agentId,
          metadata: { source: 'claude-code', sessionKey },
        });
        saveSession(sessionKey, session);
      } catch {
        process.exit(0);
      }
    }

    const toolName = event.tool_name || 'unknown';
    const toolInput = event.tool_input || {};
    const toolOutput = event.tool_response || {};

    // Stringify output, cap at 4 KB
    const outputStr = (typeof toolOutput === 'string'
      ? toolOutput
      : JSON.stringify(toolOutput)
    ).slice(0, 4096);

    try {
      await apiCall(config, 'POST', `/api/sessions/${session.id}/turns`, {
        role: 'TOOL',
        content: outputStr,
        toolCalls: [{ name: toolName, input: toolInput }],
      });
    } catch {}
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
