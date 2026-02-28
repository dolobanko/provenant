#!/usr/bin/env node
/**
 * Provenant Claude Code Hooks — Interactive Installer
 *
 * Usage:
 *   node install.js
 *
 * What it does:
 *   1. Asks for your Provenant API key + Agent ID
 *   2. Writes ~/.provenant/hooks-config.json
 *   3. Patches ~/.claude/settings.json to register PostToolUse + Stop hooks
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const HOOK_SCRIPT = path.resolve(__dirname, 'index.js');
const CONFIG_DIR = path.join(os.homedir(), '.provenant');
const CONFIG_FILE = path.join(CONFIG_DIR, 'hooks-config.json');
const CLAUDE_SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log('\n🔗  Provenant — Claude Code Hooks Installer\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const apiKey = await ask(rl, '  Provenant API key (pk_live_...): ');
  const agentId = await ask(rl, '  Agent ID (from Provenant dashboard): ');
  const baseUrl = await ask(rl, '  Base URL [http://localhost:4000]: ') || 'http://localhost:4000';

  rl.close();

  // Write config
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey, agentId, baseUrl }, null, 2));
  console.log(`\n  ✅  Config saved to ${CONFIG_FILE}`);

  // Patch ~/.claude/settings.json
  let settings = {};
  if (fs.existsSync(CLAUDE_SETTINGS)) {
    try { settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, 'utf8')); } catch {}
  }

  settings.hooks = settings.hooks || {};

  const postToolHook = { type: 'command', command: `node "${HOOK_SCRIPT}" post-tool` };
  const stopHook     = { type: 'command', command: `node "${HOOK_SCRIPT}" stop` };

  // PostToolUse
  settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];
  const postToolMatcher = settings.hooks.PostToolUse.find(h => h.matcher === '*');
  if (postToolMatcher) {
    postToolMatcher.hooks = postToolMatcher.hooks || [];
    if (!postToolMatcher.hooks.some(h => h.command?.includes('provenant'))) {
      postToolMatcher.hooks.push(postToolHook);
    }
  } else {
    settings.hooks.PostToolUse.push({ matcher: '*', hooks: [postToolHook] });
  }

  // Stop
  settings.hooks.Stop = settings.hooks.Stop || [];
  if (!settings.hooks.Stop.some(h => h.hooks?.some(h2 => h2.command?.includes('provenant')))) {
    settings.hooks.Stop.push({ hooks: [stopHook] });
  }

  const claudeDir = path.dirname(CLAUDE_SETTINGS);
  if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2));
  console.log(`  ✅  Hooks registered in ${CLAUDE_SETTINGS}`);

  console.log('\n  🚀  Done! Every Claude Code tool call will now be recorded in Provenant.\n');
}

main().catch((err) => { console.error(err); process.exit(1); });
