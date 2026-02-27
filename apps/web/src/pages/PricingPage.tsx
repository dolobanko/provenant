import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronRight, Check, X, Zap, Building2, Rocket } from 'lucide-react';
import { getUser } from '../lib/auth';

const FEATURES = [
  { label: 'Agents', hobby: '1', pro: '10', enterprise: 'Unlimited' },
  { label: 'Sessions / month', hobby: '1,000', pro: '100,000', enterprise: 'Unlimited' },
  { label: 'Eval runs / month', hobby: '500', pro: '10,000', enterprise: 'Unlimited' },
  { label: 'Data retention', hobby: '7 days', pro: '90 days', enterprise: 'Custom' },
  { label: 'Team members', hobby: '1', pro: '10', enterprise: 'Unlimited' },
  { label: 'Webhooks & alerts', hobby: false, pro: true, enterprise: true },
  { label: 'AI-generated eval cases', hobby: false, pro: true, enterprise: true },
  { label: 'Prompt diff viewer', hobby: true, pro: true, enterprise: true },
  { label: 'Audit log', hobby: true, pro: true, enterprise: true },
  { label: 'GitHub Actions eval gate', hobby: true, pro: true, enterprise: true },
  { label: 'TypeScript + Python SDKs', hobby: true, pro: true, enterprise: true },
  { label: 'SSO / SAML', hobby: false, pro: false, enterprise: true },
  { label: 'Self-hosting / BYOC', hobby: false, pro: false, enterprise: true },
  { label: 'SLA & dedicated support', hobby: false, pro: false, enterprise: true },
  { label: 'Support', hobby: 'Community', pro: 'Email', enterprise: 'Dedicated' },
];

const FAQ = [
  {
    q: 'Can I change plans later?',
    a: 'Yes. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the end of your billing cycle.',
  },
  {
    q: 'What counts as a session?',
    a: 'One session = one agent conversation from start to finish, regardless of how many turns it contains. Sessions are created when you call create_session() and ended with end_session().',
  },
  {
    q: 'Do you offer a free trial for Pro?',
    a: 'Yes — start with Hobby for free (no credit card required). When you\'re ready to upgrade, your first 14 days on Pro are free.',
  },
  {
    q: 'Is my data secure?',
    a: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Enterprise plans include SOC 2 Type II reports, custom data residency, and self-hosting options for full data control.',
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value
      ? <Check className="w-4 h-4 text-green-400 mx-auto" />
      : <X className="w-4 h-4 text-gray-700 mx-auto" />;
  }
  return <span className="text-sm text-gray-300">{value}</span>;
}

export function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (getUser()) return <Navigate to="/dashboard" replace />;

  const proPrice = billing === 'monthly' ? 49 : 39;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 overflow-x-hidden">

      {/* ── Navbar ── */}
      <header className="border-b border-gray-800/60 sticky top-0 z-50 bg-gray-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Provenant</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <Link to="/#features" className="hover:text-gray-200 transition-colors">Features</Link>
            <Link to="/pricing" className="text-white font-medium">Pricing</Link>
            <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="hover:text-gray-200 transition-colors">Docs</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm py-1.5 px-4">Get started</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-20 pb-12 px-6 text-center relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-brand-600/8 blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-gray-400 mb-10">
            Start free. Scale as you grow. No hidden fees.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-2 p-1 rounded-lg bg-gray-900 border border-gray-800 mb-2">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                billing === 'monthly'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                billing === 'annual'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Annual
              <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-semibold">
                −20%
              </span>
            </button>
          </div>
          {billing === 'annual' && (
            <p className="text-xs text-green-400 mt-1">Billed annually. Save up to $120/year.</p>
          )}
        </div>
      </section>

      {/* ── Pricing cards ── */}
      <section className="px-6 pb-16 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">

          {/* Hobby */}
          <div className="card flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <div className="font-semibold text-white">Hobby</div>
                <div className="text-xs text-gray-500">For personal projects</div>
              </div>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">Free</span>
              <span className="text-gray-500 text-sm ml-2">forever</span>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {['1 agent', '1,000 sessions / month', '500 eval runs / month', '7-day retention', 'Community support'].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                  <Check className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/register" className="btn-secondary text-center w-full py-2.5">
              Get started free
            </Link>
          </div>

          {/* Pro — highlighted */}
          <div className="relative card flex flex-col ring-2 ring-brand-600">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-brand-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Most popular
              </span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-brand-600/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <div className="font-semibold text-white">Pro</div>
                <div className="text-xs text-gray-500">For growing teams</div>
              </div>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">${proPrice}</span>
              <span className="text-gray-500 text-sm ml-2">/ month</span>
              {billing === 'annual' && (
                <div className="text-xs text-gray-500 mt-1">Billed as ${proPrice * 12}/year</div>
              )}
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {[
                '10 agents',
                '100,000 sessions / month',
                '10,000 eval runs / month',
                '90-day retention',
                'Webhooks & Slack alerts',
                'AI-generated eval cases',
                '10 team members',
                'Email support',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/register" className="btn-primary text-center w-full py-2.5">
              Start free trial
            </Link>
            <p className="text-center text-xs text-gray-500 mt-2">14-day free trial, no card required</p>
          </div>

          {/* Enterprise */}
          <div className="card flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <div className="font-semibold text-white">Enterprise</div>
                <div className="text-xs text-gray-500">For large organizations</div>
              </div>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">Custom</span>
            </div>
            <ul className="space-y-2.5 mb-8 flex-1">
              {[
                'Unlimited agents & sessions',
                'Custom data retention',
                'SSO / SAML (Okta, Azure AD)',
                'Self-hosting / BYOC',
                'SOC 2 Type II',
                'Dedicated support & SLA',
                'Custom contracts & invoicing',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                  <Check className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="mailto:hello@provenant.dev"
              className="btn-secondary text-center w-full py-2.5"
            >
              Contact us
            </a>
          </div>
        </div>
      </section>

      {/* ── Feature comparison table ── */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold text-white text-center mb-6">Full feature comparison</h2>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="table-header text-left w-1/2">Feature</th>
                <th className="table-header text-center">Hobby</th>
                <th className="table-header text-center text-brand-400">Pro</th>
                <th className="table-header text-center">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((row, i) => (
                <tr key={row.label} className={`border-b border-gray-800 ${i % 2 === 0 ? 'bg-gray-900/30' : ''}`}>
                  <td className="table-cell text-gray-400">{row.label}</td>
                  <td className="table-cell text-center"><CellValue value={row.hobby} /></td>
                  <td className="table-cell text-center"><CellValue value={row.pro} /></td>
                  <td className="table-cell text-center"><CellValue value={row.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 pb-20 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-white text-center mb-8">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <div key={i} className="card !p-0 overflow-hidden">
              <button
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-800/40 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-medium text-white text-sm">{item.q}</span>
                <ChevronRight
                  className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-90' : ''}`}
                />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed border-t border-gray-800">
                  <div className="pt-3">{item.a}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-6 pb-20 max-w-3xl mx-auto text-center">
        <div className="card bg-gradient-to-br from-brand-900/40 to-gray-900 border-brand-800/40 !p-12">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to ship safer AI agents?</h2>
          <p className="text-gray-400 mb-6">Start for free. No credit card required.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="btn-primary px-8 py-3">
              Create free workspace
            </Link>
            <a href="mailto:hello@provenant.dev" className="btn-secondary px-8 py-3">
              Talk to sales
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-5 h-5 rounded bg-brand-600 flex items-center justify-center">
              <ChevronRight className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-gray-400">Provenant</span>
            <span>·</span>
            <span>© 2026</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="hover:text-gray-300 transition-colors">Docs</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
            <Link to="/login" className="hover:text-gray-300 transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-gray-300 transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
