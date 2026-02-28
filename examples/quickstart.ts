/**
 * Provenant SDK Quickstart
 *
 * Demonstrates the full end-to-end flow:
 *   1. Register an org + user
 *   2. Create an agent
 *   3. Start a session
 *   4. Add 4 turns (user → assistant → user → assistant)
 *   5. End the session
 *   6. Fetch and print the session with cost
 *
 * Run with:
 *   npx tsx examples/quickstart.ts
 *
 * Prerequisites:
 *   - API server running on http://localhost:4000 (run `bash dev.sh` first)
 */

const BASE_URL = process.env.API_URL ?? 'http://localhost:4000/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }

  return data as T;
}

function log(label: string, value: unknown) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶  ${label}`);
  console.log(JSON.stringify(value, null, 2));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Provenant Quickstart\n');

  // ── 1. Register ──────────────────────────────────────────────────────────────
  const orgSlug = `demo-${Date.now()}`;
  const email = `demo+${Date.now()}@example.com`;

  const { token, user, org } = await req<{
    token: string;
    user: { id: string; name: string; email: string; role: string };
    org: { id: string; name: string; slug: string };
  }>('POST', '/auth/register', {
    name: 'Demo User',
    email,
    password: 'securepassword123',
    orgName: 'Demo Org',
    orgSlug,
  });

  log('1. Registered user + org', { user, org });

  // ── 2. Create agent ───────────────────────────────────────────────────────────
  const agent = await req<{
    id: string;
    name: string;
    slug: string;
    status: string;
  }>('POST', '/agents', {
    name: 'Support Agent',
    slug: `support-${Date.now()}`,
    description: 'Handles customer support queries',
    modelFamily: 'claude-3',
    tags: ['support', 'demo'],
  }, token);

  log('2. Created agent', agent);

  // ── 3. Create agent version (optional but recommended) ────────────────────────
  const version = await req<{
    id: string;
    version: number;
    semver: string;
    modelId: string;
  }>('POST', `/agents/${agent.id}/versions`, {
    version: '1',
    semver: '1.0.0',
    changelog: 'Initial version',
    systemPrompt: 'You are a helpful customer support assistant. Be concise and friendly.',
    modelId: 'claude-haiku-4-5',
    parameters: { temperature: 0.7, maxTokens: 1000 },
  }, token);

  log('3. Created agent version', version);

  // ── 4. Start session ──────────────────────────────────────────────────────────
  const session = await req<{ id: string; status: string; startedAt: string }>(
    'POST',
    '/sessions',
    {
      agentId: agent.id,
      agentVersionId: version.id,
      metadata: { source: 'quickstart', channel: 'email' },
      tags: ['demo'],
    },
    token,
  );

  log('4. Started session', session);

  // ── 5. Add turns ──────────────────────────────────────────────────────────────
  const turns = [
    {
      role: 'USER',
      content: "Hi, I can't log into my account. It says my password is incorrect.",
      latencyMs: 0,
    },
    {
      role: 'ASSISTANT',
      content: "I'm sorry to hear that! Let me help you regain access. Can you confirm the email address associated with your account?",
      latencyMs: 820,
      inputTokens: 45,
      outputTokens: 32,
    },
    {
      role: 'USER',
      content: 'Sure, it\'s jane@example.com',
      latencyMs: 0,
    },
    {
      role: 'ASSISTANT',
      content: "Thanks Jane! I've sent a password reset link to jane@example.com. You should receive it within 2 minutes. Is there anything else I can help with?",
      latencyMs: 1050,
      inputTokens: 78,
      outputTokens: 41,
    },
  ];

  for (const turn of turns) {
    const created = await req<{ id: string; role: string }>(
      'POST',
      `/sessions/${session.id}/turns`,
      turn,
      token,
    );
    console.log(`   ✓ Added ${created.role} turn (${created.id.slice(0, 8)}…)`);
  }

  // ── 6. End session ────────────────────────────────────────────────────────────
  const totalInputTokens = turns.reduce((a, t) => a + (t.inputTokens ?? 0), 0);
  const totalOutputTokens = turns.reduce((a, t) => a + (t.outputTokens ?? 0), 0);
  const totalTokens = totalInputTokens + totalOutputTokens;
  const totalLatencyMs = turns.reduce((a, t) => a + (t.latencyMs ?? 0), 0);

  await req<{ status: string }>(
    'POST',
    `/sessions/${session.id}/end`,
    { totalTokens, totalLatencyMs },
    token,
  );
  console.log('\n   ✓ Session ended');

  // ── 7. Fetch session with cost ────────────────────────────────────────────────
  const fullSession = await req<{
    id: string;
    status: string;
    totalTokens: number;
    totalLatencyMs: number;
    costUsd: number | null;
    turns: unknown[];
    agent: { name: string };
  }>('GET', `/sessions/${session.id}`, undefined, token);

  log('7. Final session', {
    id: fullSession.id,
    status: fullSession.status,
    agent: fullSession.agent.name,
    turns: fullSession.turns.length,
    totalTokens: fullSession.totalTokens,
    totalLatencyMs: `${fullSession.totalLatencyMs}ms`,
    estimatedCost: fullSession.costUsd != null ? `$${fullSession.costUsd.toFixed(6)}` : 'N/A (no model pricing)',
  });

  console.log('\n\n✅ Quickstart complete!\n');
  console.log('   Next steps:');
  console.log('   • Open http://localhost:5173 and sign in with:');
  console.log(`     Email:    ${email}`);
  console.log('     Password: securepassword123');
  console.log(`   • Navigate to Sessions → look for session ${session.id.slice(0, 8)}…`);
  console.log('   • Try creating an eval suite and running it against your agent');
  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
