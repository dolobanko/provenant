import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getUser } from '../lib/auth';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, isToday, startOfMonth } from 'date-fns';
import {
  Bot, MessageSquare, AlertTriangle, CheckCircle, Clock,
  TrendingUp, DollarSign, ShieldAlert,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton } from '../components/Skeleton';
import { OnboardingChecklist } from '../components/OnboardingChecklist';

interface Agent { id: string; name: string; status: string; }
interface Session {
  id: string; status: string; startedAt: string;
  costUsd: number | null; totalLatencyMs: number | null;
  agent: { name: string; id: string };
  environment: { name: string; type: string } | null;
  agentVersion: { semver: string } | null;
  _count: { turns: number };
}
interface DriftReport { id: string; severity: string; resolvedAt: string | null; agent: { name: string; id: string }; createdAt: string; }
interface Violation { id: string; severity: string; resolvedAt: string | null; policy: { name: string }; createdAt: string; }
interface Overview { agents: number; sessions: number; evalRuns: number; }
interface ApiKey { id: string; }

function KpiCard({
  icon: Icon, label, value, subtitle, color, valueColor,
}: {
  icon: typeof Bot; label: string; value: string | number;
  subtitle: string; color: string; valueColor?: string;
}) {
  return (
    <div className="card">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className={`text-3xl font-bold mb-1 ${valueColor ?? 'text-white'}`}>{value}</p>
      <p className="text-sm font-medium text-gray-300 mb-0.5">{label}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

const envColors: Record<string, string> = {
  PRODUCTION: 'badge-green', STAGING: 'badge-yellow', DEVELOPMENT: 'badge-blue',
};

export function DashboardPage() {
  const user = getUser();

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions').then((r) => r.data),
  });

  const { data: driftReports = [] } = useQuery<DriftReport[]>({
    queryKey: ['drift-reports'],
    queryFn: () => api.get('/drift/reports').then((r) => r.data),
  });

  const { data: violations = [] } = useQuery<Violation[]>({
    queryKey: ['violations'],
    queryFn: () => api.get('/policies/violations').then((r) => r.data),
  });

  const { data: overview } = useQuery<Overview>({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data),
  });

  const { data: apiKeys = [] } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/org/keys').then((r) => r.data),
  });

  const isLoading = agentsLoading || sessionsLoading;

  // ── Status banner ──────────────────────────────────────────────────────────
  const openDrift = driftReports.filter((d) => !d.resolvedAt);
  const openViolations = violations.filter((v) => !v.resolvedAt);
  const hasHighCritical =
    openDrift.some((d) => d.severity === 'HIGH' || d.severity === 'CRITICAL') ||
    openViolations.some((v) => v.severity === 'HIGH' || v.severity === 'CRITICAL');
  const hasMedium =
    openDrift.some((d) => d.severity === 'MEDIUM') ||
    openViolations.some((v) => v.severity === 'MEDIUM');
  const bannerState: 'green' | 'amber' | 'red' = hasHighCritical ? 'red' : hasMedium ? 'amber' : 'green';
  const bannerCount = openDrift.length + openViolations.length;

  // ── KPI calculations ───────────────────────────────────────────────────────
  const activeAgents = agents.filter((a) => a.status === 'ACTIVE').length;
  const activityToday = sessions.filter((s) => isToday(new Date(s.startedAt))).length;
  const issuesOpen = openDrift.length + openViolations.length;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sessions7d = sessions.filter((s) => new Date(s.startedAt) >= sevenDaysAgo);
  const totalTurns7d = sessions7d.reduce((acc, s) => acc + (s._count?.turns ?? 0), 0);
  const costSaved7d = totalTurns7d * 2 * 0.25; // turns × 2 min avg × $0.25/min

  // ── ROI calculation ────────────────────────────────────────────────────────
  const monthStart = startOfMonth(new Date());
  const sessionsThisMonth = sessions.filter((s) => new Date(s.startedAt) >= monthStart);
  const roiThisMonth = sessionsThisMonth.length * 8.5;

  // ── Per-agent health score ─────────────────────────────────────────────────
  function agentHealthScore(agentId: string): number {
    let score = 100;
    for (const d of openDrift.filter((d) => d.agent?.id === agentId)) {
      if (d.severity === 'CRITICAL' || d.severity === 'HIGH') score -= 30;
      else if (d.severity === 'MEDIUM') score -= 15;
      else score -= 5;
    }
    return Math.max(0, score);
  }

  function healthDotClass(score: number) {
    return score >= 80 ? 'bg-green-400' : score >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  }
  function healthTextClass(score: number) {
    return score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  }

  // ── Agent rows ─────────────────────────────────────────────────────────────
  const agentRows = agents.map((agent) => {
    const agentSessions = sessions.filter((s) => s.agent?.id === agent.id);
    const aSessions7d = agentSessions.filter((s) => new Date(s.startedAt) >= sevenDaysAgo);
    const sorted = [...agentSessions].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    const lastActive = sorted[0] ? new Date(sorted[0].startedAt) : null;
    const latencies = aSessions7d.filter((s) => s.totalLatencyMs != null).map((s) => s.totalLatencyMs!);
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
    const cost7d = aSessions7d
      .filter((s) => s.costUsd != null)
      .reduce((acc, s) => acc + (s.costUsd ?? 0), 0);
    const score = agentHealthScore(agent.id);
    return { agent, sessions7d: aSessions7d, lastActive, avgLatency, cost7d, score };
  });

  // ── Alerts list ────────────────────────────────────────────────────────────
  type AlertItem = { id: string; label: string; severity: string; time: string };
  const alerts: AlertItem[] = [
    ...openDrift.map((d) => ({
      id: `drift-${d.id}`,
      label: `Drift detected — ${d.agent.name}`,
      severity: d.severity,
      time: d.createdAt,
    })),
    ...openViolations.map((v) => ({
      id: `violation-${v.id}`,
      label: `Policy violation — ${v.policy.name}`,
      severity: v.severity,
      time: v.createdAt,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const recentSessions = sessions.slice(0, 5);

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-gray-400 mt-1">Here's how your AI agents are performing</p>
      </div>

      {/* Onboarding */}
      <OnboardingChecklist
        agentCount={overview?.agents ?? agents.length}
        apiKeyCount={apiKeys.length}
        sessionCount={overview?.sessions ?? sessions.length}
      />

      {/* ── Status Banner ──────────────────────────────────────────────────── */}
      {!isLoading && (
        <div
          className={`mb-6 rounded-xl p-4 flex items-center gap-4 border ${
            bannerState === 'green'
              ? 'bg-green-950/30 border-green-800/40'
              : bannerState === 'amber'
              ? 'bg-amber-950/30 border-amber-800/40'
              : 'bg-red-950/30 border-red-800/40'
          }`}
        >
          {bannerState === 'green' ? (
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          ) : (
            <AlertTriangle
              className={`w-5 h-5 flex-shrink-0 ${
                bannerState === 'red' ? 'text-red-400' : 'text-amber-400'
              }`}
            />
          )}
          <div>
            <p
              className={`font-semibold text-sm ${
                bannerState === 'green'
                  ? 'text-green-300'
                  : bannerState === 'amber'
                  ? 'text-amber-300'
                  : 'text-red-300'
              }`}
            >
              {bannerState === 'green'
                ? 'All Clear'
                : bannerState === 'amber'
                ? 'Needs Attention'
                : 'Action Required'}
            </p>
            <p className="text-xs text-gray-400">
              {bannerState === 'green'
                ? 'All your agents are operating normally.'
                : bannerState === 'amber'
                ? `${bannerCount} issue${bannerCount !== 1 ? 's' : ''} need${bannerCount === 1 ? 's' : ''} your attention.`
                : 'Critical issues detected across your agents.'}
            </p>
          </div>
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => <div key={i} className="card animate-pulse h-32 bg-gray-900/50" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            icon={Bot}
            label="Active Agents"
            value={activeAgents}
            subtitle="running in production"
            color="bg-brand-600/20 text-brand-400"
          />
          <KpiCard
            icon={MessageSquare}
            label="Activity Today"
            value={activityToday}
            subtitle="conversations handled"
            color="bg-blue-900/40 text-blue-400"
          />
          <KpiCard
            icon={ShieldAlert}
            label="Issues Open"
            value={issuesOpen}
            subtitle="drift + violations"
            color={issuesOpen > 0 ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}
            valueColor={issuesOpen > 0 ? 'text-red-400' : 'text-green-400'}
          />
          <KpiCard
            icon={DollarSign}
            label="Cost Saved This Week"
            value={`$${costSaved7d.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            subtitle="vs. human agents @ $0.25/min"
            color="bg-emerald-900/40 text-emerald-400"
          />
        </div>
      )}

      {/* ── ROI Card ───────────────────────────────────────────────────────── */}
      <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-5 mb-6 flex items-center gap-6">
        <div className="w-12 h-12 rounded-xl bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-emerald-400 font-medium uppercase tracking-wide mb-1">
            Estimated value delivered this month
          </p>
          <p className="text-3xl font-bold text-white">
            ${roiThisMonth.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            Based on {sessionsThisMonth.length} conversation{sessionsThisMonth.length !== 1 ? 's' : ''} handled automatically
          </p>
        </div>
        <p className="text-xs text-gray-600 text-right hidden md:block max-w-[180px] leading-relaxed">
          Industry average: $8.50 per human-handled interaction
        </p>
      </div>

      {/* ── Agent Health Table ─────────────────────────────────────────────── */}
      <div className="card mb-6">
        <h2 className="text-base font-semibold text-white mb-4">Agent Health</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : agentRows.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No agents yet.{' '}
            <Link to="/agents" className="text-brand-400 hover:text-brand-300">
              Create your first agent →
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Agent</th>
                  <th className="table-header">Health</th>
                  <th className="table-header">Conversations (7d)</th>
                  <th className="table-header">Avg Latency</th>
                  <th className="table-header">Est. Cost (7d)</th>
                  <th className="table-header">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {agentRows.map(({ agent, sessions7d: aSessions7d, lastActive, avgLatency, cost7d, score }) => (
                  <tr
                    key={agent.id}
                    className="table-row cursor-pointer"
                    onClick={() => window.location.assign(`/agents/${agent.id}`)}
                  >
                    <td className="table-cell font-medium text-white">{agent.name}</td>
                    <td className="table-cell">
                      <span className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${healthDotClass(score)}`} />
                        <span className={`text-sm font-semibold ${healthTextClass(score)}`}>{score}</span>
                        <span className="text-xs text-gray-500">/ 100</span>
                      </span>
                    </td>
                    <td className="table-cell">{aSessions7d.length}</td>
                    <td className="table-cell text-xs">
                      {avgLatency != null
                        ? avgLatency < 1000 ? `${avgLatency}ms` : `${(avgLatency / 1000).toFixed(1)}s`
                        : '—'}
                    </td>
                    <td className="table-cell text-xs">${cost7d.toFixed(4)}</td>
                    <td className="table-cell text-xs text-gray-400">
                      {lastActive ? formatDistanceToNow(lastActive, { addSuffix: true }) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bottom panels ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Recent Activity</h2>
            <Link to="/conversations" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
          </div>
          {sessionsLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : recentSessions.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No conversations yet.</p>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <Link
                  key={s.id}
                  to={`/conversations/${s.id}`}
                  className="flex items-start gap-3 p-3 bg-gray-800/60 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-200 truncate">{s.agent?.name}</span>
                      {s.environment && (
                        <span className={`badge ${envColors[s.environment.type] ?? 'badge-gray'} text-xs`}>
                          {s.environment.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {s._count.turns} turn{s._count.turns !== 1 ? 's' : ''} ·{' '}
                      {formatDistanceToNow(new Date(s.startedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Alerts</h2>
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <p className="text-sm text-green-400 font-medium">No active alerts</p>
              <p className="text-xs text-gray-500">Everything looks good</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 8).map((alert) => (
                <div key={alert.id} className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-lg">
                  <AlertTriangle
                    className={`w-4 h-4 flex-shrink-0 ${
                      alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
                        ? 'text-red-400'
                        : alert.severity === 'MEDIUM'
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">{alert.label}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(alert.time), { addSuffix: true })}
                    </p>
                  </div>
                  <StatusBadge status={alert.severity} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
