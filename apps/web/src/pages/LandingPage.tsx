import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ChevronRight, MessageSquare, Activity, FlaskConical, Shield,
  GitBranch, Zap, ArrowRight, Terminal, Check,
} from 'lucide-react';
import { getUser } from '../lib/auth';

// ── Code snippets ──────────────────────────────────────────────────────────

const TS_SNIPPET = `import { ProvenantClient } from '@provenant/sdk';

const client = new ProvenantClient({
  baseUrl: process.env.PROVENANT_URL,
  apiKey:  process.env.PROVENANT_API_KEY,
});

// Create a session for your agent
const session = await client.sessions.create({
  agentId: 'my-support-bot',
});

// Record every turn
await client.sessions.addTurn(session.id, {
  role: 'USER',
  content: userMessage,
  inputTokens: 120,
});

await client.sessions.addTurn(session.id, {
  role: 'ASSISTANT',
  content: agentResponse,
  outputTokens: 340,
  latencyMs: 820,
});

await client.sessions.end(session.id);`;

const PY_SNIPPET = `from provenant_sdk import ProvenantClient
import os

client = ProvenantClient(
    base_url=os.environ["PROVENANT_URL"],
    api_key=os.environ["PROVENANT_API_KEY"],
)

# Create a session for your agent
session = client.create_session(agent_id="my-support-bot")

# Record every turn
client.add_turn(
    session["id"],
    role="USER",
    content=user_message,
    input_tokens=120,
)

client.add_turn(
    session["id"],
    role="ASSISTANT",
    content=agent_response,
    output_tokens=340,
    latency_ms=820,
)

client.end_session(session["id"])`;

const CI_SNIPPET = `# .github/workflows/deploy.yml
- name: Run eval gate
  uses: your-org/provenant/.github/workflows/eval-gate-action@main
  with:
    api_url:       \${{ vars.PROVENANT_URL }}
    api_key:       \${{ secrets.PROVENANT_API_KEY }}
    suite_id:      'a1b2c3d4-...'
    agent_id:      'my-support-bot'
    min_pass_rate: '0.85'   # fail PR if < 85% pass`;

// ── Syntax highlight helpers ───────────────────────────────────────────────
// Single-pass tokeniser — each character is consumed only once, so
// there is no risk of a later regex matching inside an already-emitted tag.

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
  const re = /(#[^\n]*)|("(?:[^"\\]|\\.)*")|(\b(?:from|import|os|None|True|False)\b)|(\b(?:def|return|if|else|for|in|with|as|not|and|or)\b)/g;
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
    desc: 'Capture every turn of every agent conversation. Replay, inspect tool calls, and debug failures with full token-level detail.',
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
    desc: 'Build test suites with custom scoring functions. Import pre-built templates for customer support, coding agents, and RAG pipelines.',
  },
  {
    icon: Shield,
    color: 'text-green-400',
    bg: 'bg-green-900/30',
    title: 'Policy Engine',
    desc: 'Enforce content, rate-limit, and deployment policies with configurable rules. Auto-block or notify on violations.',
  },
  {
    icon: GitBranch,
    color: 'text-brand-400',
    bg: 'bg-brand-900/30',
    title: 'Prompt Versioning',
    desc: 'Version every system prompt, compare diffs across releases, and roll back to any previous version instantly.',
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
    title: 'Instrument your agent',
    desc: 'Add the SDK (TypeScript or Python) and wrap your agent calls. Zero breaking changes to your existing code.',
  },
  {
    n: '02',
    title: 'Observe in the dashboard',
    desc: 'Sessions, drift reports, eval runs, and version history appear in real time. No config required.',
  },
  {
    n: '03',
    title: 'Gate every deployment',
    desc: 'Add one step to your GitHub Actions workflow. PRs that break evals are blocked automatically.',
  },
];

const STATS = [
  { value: 'TypeScript + Python', label: 'Official SDKs' },
  { value: '4', label: 'Built-in eval templates' },
  { value: '< 5 min', label: 'Time to first session' },
  { value: 'GitHub Actions', label: 'Native CI/CD' },
];

// ── Component ──────────────────────────────────────────────────────────────

export function LandingPage() {
  const [tab, setTab] = useState<'ts' | 'py' | 'ci'>('ts');

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
            Built for AI engineering teams
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
            The AgentOps platform<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-blue-400">
              built for AI teams
            </span>
          </h1>

          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Session replay, drift detection, eval benchmarking, prompt versioning,
            and policy enforcement — unified in one platform with TypeScript and Python SDKs.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
              Native SDKs for TypeScript and Python. No framework lock-in.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-800/60 p-1 rounded-lg w-fit mx-auto mb-6 border border-gray-700">
            {([['ts', 'TypeScript'], ['py', 'Python'], ['ci', 'GitHub Actions']] as const).map(([key, label]) => (
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
                {tab === 'ts' ? 'instrument.ts' : tab === 'py' ? 'instrument.py' : 'deploy.yml'}
              </span>
            </div>
            <pre className="p-5 text-xs leading-relaxed overflow-x-auto">
              {tab === 'ts' && <TS>{TS_SNIPPET}</TS>}
              {tab === 'py' && <PY>{PY_SNIPPET}</PY>}
              {tab === 'ci' && <PY>{CI_SNIPPET}</PY>}
            </pre>
          </div>

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
              Three steps from your first session to a fully gated deployment pipeline.
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
              'Full session replay with token-level detail',
              'Automatic prompt drift alerts',
              'Custom and built-in eval scoring functions',
              'Role-based access control for teams',
              'Immutable audit log for compliance',
              'Analytics dashboards out of the box',
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
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
            <Link to="/login" className="hover:text-gray-300 transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-gray-300 transition-colors">Register</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
