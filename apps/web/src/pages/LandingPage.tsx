import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ChevronRight, MessageSquare, Activity, FlaskConical, Shield,
  GitBranch, Zap, ArrowRight, Terminal, Check, Wrench, Layers,
} from 'lucide-react';
import { getUser } from '../lib/auth';

// ── Code snippets ──────────────────────────────────────────────────────────

const TS_SNIPPET = `import Anthropic from '@anthropic-ai/sdk';
import { instrument } from '@provenant/sdk';

// One line — every LLM call recorded automatically
const client = instrument(new Anthropic(), {
  apiKey:  'pk_live_...',
  agentId: 'support-bot',   // name → auto-created in dashboard
  baseUrl: 'https://api.provenant.dev',
});

// Zero changes to your existing agent code
const response = await client.messages.create({
  model: 'claude-opus-4-5',
  messages: [{ role: 'user', content: userMessage }],
  max_tokens: 1024,
});`;

const PY_SNIPPET = `import anthropic
from provenant_sdk import instrument

# One line — every LLM call recorded automatically
client = instrument(
    anthropic.Anthropic(),
    api_key="pk_live_...",
    agent_id="support-bot",   # name → auto-created in dashboard
    base_url="https://api.provenant.dev",
)

# Zero changes to your existing agent code
response = client.messages.create(
    model="claude-opus-4-5",
    messages=[{"role": "user", "content": user_message}],
    max_tokens=1024,
)`;

const MULTITURN_SNIPPET = `from provenant_sdk import ProvenantClient, instrument

prov = ProvenantClient(base_url="...", api_key="pk_live_...")
client = instrument(anthropic.Anthropic(), api_key="pk_live_...",
                    agent_id="<uuid>", base_url="...")

# Group a full agent loop into one session with multiple turns
with prov.session(agent_id, user_id="u123") as sid:

    # Turn 1 — agent calls a tool
    r1 = client.messages.create(
        model="claude-opus-4-5",
        tools=[web_search_tool],
        messages=[{"role": "user", "content": query}],
        max_tokens=1024,
    )
    # tool_use block → captured in ASSISTANT turn automatically

    # Turn 2 — agent gets tool result, answers
    r2 = client.messages.create(
        model="claude-opus-4-5",
        messages=[..., tool_result_message],
        max_tokens=1024,
    )
    # tool_result → TOOL turn; final answer → ASSISTANT turn

# Session ended automatically — 4 turns in the dashboard`;

const CI_SNIPPET = `# .github/workflows/deploy.yml
- name: Run eval gate
  uses: your-org/provenant/.github/workflows/eval-gate-action@main
  with:
    api_url:       \${{ vars.PROVENANT_URL }}
    api_key:       \${{ secrets.PROVENANT_API_KEY }}
    suite_id:      'a1b2c3d4-...'
    agent_id:      'support-bot'
    min_pass_rate: '0.85'   # block merge if < 85% pass`;

// ── Syntax highlight helpers ───────────────────────────────────────────────

type Token = { t: 'kw1' | 'kw2' | 'str' | 'comment' | 'plain'; v: string };

function tokeniseTS(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /(\/\/[^\n]*)|((?:'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`))|(\b(?:import|from|const|await|new|process|export|type)\b)|(\b(?:async|function|return|void|let|var)\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) tokens.push({ t: 'plain', v: src.slice(last, m.index) });
    if (m[1]) tokens.push({ t: 'comment', v: m[1] });
    else if (m[2]) tokens.push({ t: 'str', v: m[2] });
    else if (m[3]) tokens.push({ t: 'kw1', v: m[3] });
    else if (m[4]) tokens.push({ t: 'kw2', v: m[4] });
    last = m.index + m[0].length;
  }
  if (last < src.length) tokens.push({ t: 'plain', v: src.slice(last) });
  return tokens;
}

function tokenisePY(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:from|import|os|None|True|False|with|as)\b)|(\b(?:def|return|if|else|for|in|not|and|or|await|async)\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) tokens.push({ t: 'plain', v: src.slice(last, m.index) });
    if (m[1]) tokens.push({ t: 'comment', v: m[1] });
    else if (m[2]) tokens.push({ t: 'str', v: m[2] });
    else if (m[3]) tokens.push({ t: 'kw1', v: m[3] });
    else if (m[4]) tokens.push({ t: 'kw2', v: m[4] });
    last = m.index + m[0].length;
  }
  if (last < src.length) tokens.push({ t: 'plain', v: src.slice(last) });
  return tokens;
}

const COLOR: Record<Token['t'], string> = {
  comment: '#6b7280',
  str:     '#4ade80',
  kw1:     '#c084fc',
  kw2:     '#60a5fa',
  plain:   '',
};

function Code({ tokens }: { tokens: Token[] }) {
  return (
    <code className="block text-gray-300 text-xs leading-relaxed font-mono whitespace-pre">
      {tokens.map((tok, i) =>
        tok.t === 'plain'
          ? <span key={i}>{tok.v}</span>
          : <span key={i} style={{ color: COLOR[tok.t] }}>{tok.v}</span>
      )}
    </code>
  );
}

function TS({ children }: { children: string }) {
  return <Code tokens={tokeniseTS(children)} />;
}

function PY({ children }: { children: string }) {
  return <Code tokens={tokenisePY(children)} />;
}

// ── Features ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: MessageSquare,
    color: 'text-blue-400',
    bg: 'bg-blue-900/30',
    title: 'Session Replay',
    desc: 'Capture every turn of every agent conversation with full tool call and token-level detail. Replay and debug failures in seconds.',
  },
  {
    icon: Wrench,
    color: 'text-cyan-400',
    bg: 'bg-cyan-900/30',
    title: 'Tool Call Tracking',
    desc: 'Automatic capture of tool_use blocks and tool_results. See exactly what tools your agent called, what inputs it used, and what it got back.',
  },
  {
    icon: Activity,
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/30',
    title: 'Drift Detection',
    desc: 'Baseline your agent\'s behaviour and get alerted the moment output semantics, tone, or quality shift in production.',
  },
  {
    icon: FlaskConical,
    color: 'text-purple-400',
    bg: 'bg-purple-900/30',
    title: 'Eval Framework',
    desc: 'Build test suites with AI-generated test cases and custom scoring. Block deploys when pass rate drops below your threshold.',
  },
  {
    icon: Layers,
    color: 'text-indigo-400',
    bg: 'bg-indigo-900/30',
    title: 'Multi-Turn Sessions',
    desc: 'Group entire agent loops — tool calls, retries, follow-ups — into a single session. See the full execution path, not just isolated calls.',
  },
  {
    icon: GitBranch,
    color: 'text-brand-400',
    bg: 'bg-brand-900/30',
    title: 'Prompt Versioning',
    desc: 'Version every system prompt, compare diffs across releases, and roll back to any previous version instantly.',
  },
  {
    icon: Shield,
    color: 'text-green-400',
    bg: 'bg-green-900/30',
    title: 'Policy Engine',
    desc: 'Enforce content, rate-limit, and deployment policies with configurable rules. Auto-block or notify on violations.',
  },
  {
    icon: Zap,
    color: 'text-orange-400',
    bg: 'bg-orange-900/30',
    title: 'CI/CD Eval Gate',
    desc: 'Block merges or deploys when eval pass rate drops below your threshold. Native GitHub Actions integration — one YAML line.',
  },
];

const HOW_IT_WORKS = [
  {
    n: '01',
    title: 'One-line instrumentation',
    desc: 'Wrap your Anthropic or OpenAI client with instrument(). Sessions, turns, tool calls, latency, and token counts all flow in automatically.',
  },
  {
    n: '02',
    title: 'Observe in the dashboard',
    desc: 'Multi-turn sessions, tool execution traces, drift reports, and eval runs appear in real time. No config required.',
  },
  {
    n: '03',
    title: 'Gate every deployment',
    desc: 'Add one step to your GitHub Actions workflow. PRs that break evals are blocked automatically.',
  },
];

const STATS = [
  { value: '1 line', label: 'To instrument an agent' },
  { value: 'TypeScript + Python', label: 'Official SDKs' },
  { value: 'Sync + Async', label: 'Client support' },
  { value: 'GitHub Actions', label: 'Native CI/CD' },
];

// ── Component ──────────────────────────────────────────────────────────────

export function LandingPage() {
  const [tab, setTab] = useState<'ts' | 'py' | 'multi' | 'ci'>('ts');

  // Authenticated users go straight to the dashboard
  if (getUser()) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 overflow-x-hidden">

      {/* ── Navbar ── */}
      <header className="border-b border-gray-800/60 sticky top-0 z-50 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Provenant</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-gray-200 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-200 transition-colors">How it works</a>
            <Link to="/pricing" className="hover:text-gray-200 transition-colors">Pricing</Link>
            <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="hover:text-gray-200 transition-colors">Docs</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm py-1.5 px-4">Get started</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-brand-600/10 blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-900/40 border border-brand-800/50 text-brand-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Business intelligence for AI agents
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
            The manager for your<br />
            <span className="text-brand-400">AI agents.</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Companies replacing people with AI agents need someone watching over them.
            Provenant tracks every decision, flags every problem, and gives you a full audit trail —
            so you stay in control.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link
              to="/register"
              className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
            >
              Get started free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="btn-secondary flex items-center gap-2 px-6 py-3 text-base"
            >
              Sign in to dashboard
            </Link>
          </div>

          {/* Value props */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16 text-left">
            {[
              {
                emoji: '🔍',
                title: 'Know what they\'re doing',
                desc: 'Every conversation your agents have is logged and searchable. No black boxes.',
              },
              {
                emoji: '🚨',
                title: 'Catch them when they go wrong',
                desc: 'Automated quality checks and alerts when agent behavior changes.',
              },
              {
                emoji: '📋',
                title: 'Prove you\'re in control',
                desc: 'Full audit trail for regulators, boards, and customers who ask.',
              },
            ].map((vp) => (
              <div key={vp.title} className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                <div className="text-2xl mb-3">{vp.emoji}</div>
                <h3 className="font-semibold text-white text-sm mb-1.5">{vp.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{vp.desc}</p>
              </div>
            ))}
          </div>

          {/* Hero code snippet */}
          <div className="text-left bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900/80">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs text-gray-500 ml-2 font-mono">agent.ts</span>
            </div>
            <pre className="p-5 text-xs leading-relaxed overflow-x-auto">
              <TS>{TS_SNIPPET}</TS>
            </pre>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-gray-800 bg-gray-900/40">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold text-white mb-1">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything your agent needs
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              From first session to production deployment — Provenant covers the full AgentOps lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="card group hover:border-gray-700 transition-colors">
                <div className={`w-9 h-9 rounded-lg ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-4 h-4 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Code demo ── */}
      <section className="py-24 px-6 bg-gray-900/30 border-y border-gray-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Integrate in minutes
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Wrap your client once. Sessions, tool calls, multi-turn loops, and evals flow in automatically.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-800/60 p-1 rounded-lg w-fit mx-auto mb-6 border border-gray-700 flex-wrap justify-center">
            {([
              ['ts',    'TypeScript'],
              ['py',    'Python'],
              ['multi', 'Multi-Turn'],
              ['ci',    'CI/CD Gate'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === key
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
              <Terminal className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500 font-mono">
                {tab === 'ts' ? 'instrument.ts' : tab === 'py' ? 'instrument.py' : tab === 'multi' ? 'agent_loop.py' : 'deploy.yml'}
              </span>
            </div>
            <pre className="p-5 text-xs leading-relaxed overflow-x-auto">
              {tab === 'ts'    && <TS>{TS_SNIPPET}</TS>}
              {tab === 'py'    && <PY>{PY_SNIPPET}</PY>}
              {tab === 'multi' && <PY>{MULTITURN_SNIPPET}</PY>}
              {tab === 'ci'    && <PY>{CI_SNIPPET}</PY>}
            </pre>
          </div>

          {/* What gets captured callout */}
          {(tab === 'ts' || tab === 'py') && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                'Sessions & turns',
                'Tool calls & results',
                'Token counts',
                'Latency per turn',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5">
                  <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs text-gray-400">{item}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'multi' && (
            <div className="mt-4 p-4 bg-indigo-950/30 border border-indigo-800/30 rounded-lg">
              <p className="text-xs text-indigo-300 leading-relaxed">
                <span className="font-semibold text-indigo-200">Multi-turn stitching</span> — without{' '}
                <code className="bg-indigo-900/40 px-1 rounded">prov.session()</code>, each{' '}
                <code className="bg-indigo-900/40 px-1 rounded">messages.create</code> creates its own session.
                Wrap your agent loop in a session context to see the full execution in one place.
              </p>
            </div>
          )}

          {/* Install commands */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {[
              { label: 'npm', cmd: 'npm install @provenant/sdk' },
              { label: 'pip', cmd: 'pip install provenant-sdk' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                <span className="text-xs text-gray-500 font-mono w-8">{item.label}</span>
                <code className="text-sm text-brand-400 font-mono">{item.cmd}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ship with confidence
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Three steps from first session to a fully gated deployment pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.n} className="relative">
                {/* Connector line */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-gray-700 to-transparent -translate-x-4 z-0" />
                )}
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-brand-900/40 border border-brand-800/60 flex items-center justify-center mb-5">
                    <span className="text-brand-400 font-bold text-sm font-mono">{step.n}</span>
                  </div>
                  <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Checklist */}
          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'One-line instrumentation — no boilerplate',
              'Multi-turn session stitching for agent loops',
              'Automatic tool call & tool result capture',
              'Sync, async, and streaming clients supported',
              'Automatic prompt drift alerts',
              'Role-based access control for teams',
              'Custom and AI-generated eval test cases',
              'Immutable audit log for compliance',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-green-900/40 border border-green-800/50 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
                <span className="text-sm text-gray-400">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-brand-900/40 via-gray-900 to-gray-900 border border-brand-800/40 rounded-2xl p-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Start shipping safer AI agents today
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Free to get started. Instrument your first agent in under five minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="btn-primary flex items-center gap-2 px-7 py-3 text-base"
              >
                Create free workspace <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="http://localhost:3001"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary flex items-center gap-2 px-7 py-3 text-base"
              >
                Read the docs
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center flex-shrink-0">
              <ChevronRight className="w-3 h-3 text-white" />
            </div>
            <span className="text-gray-400 font-medium">Provenant</span>
            <span className="mx-2">·</span>
            <span>© 2026</span>
          </div>
          <nav className="flex items-center gap-6">
            <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="hover:text-gray-300 transition-colors">Docs</a>
            <a href="https://github.com/dolobanko/provenant" target="_blank" rel="noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
            <Link to="/login" className="hover:text-gray-300 transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-gray-300 transition-colors">Register</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
