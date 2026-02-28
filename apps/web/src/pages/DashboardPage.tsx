import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getUser } from '../lib/auth';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, isToday, startOfMonth } from 'date-fns';
import { Bot, MessageSquare, TrendingUp, DollarSign, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton } from '../components/Skeleton';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Agent { id: string; name: string; status: string; }
interface Session {
  id: string;
  status: string;
  startedAt: string;
  costUsd: number | null;
  totalTokens: number | null;
  totalLatencyMs: number | null;
  agent: { name: string; id: string };
  environment: { name: string; type: string } | null;
  agentVersion: { semver: string } | null;
  _count: { turns: number };
}
interface EvalRun { passRate: number | null; completedAt: string | null; }
interface DriftReport { id: string; severity: string; resolvedAt: string | null; agent: { name: string }; createdAt: string; }
interface Violation { id: string; severity: string; resolvedAt: string | null; policy: { name: string }; createdAt: string; }
interface TimeseriesPoint { date: string; conversations: number; costUsd: number; }
interface Overview { agents: number; sessions: number; evalRuns: number; }
interface ApiKey { id: string; }

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
  isEmpty = false,
}: {
  icon: typeof Bot;
  label: string;
  value: string | number;
  subtitle: string;
  color: string;
  isEmpty?: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className={`font-bold mb-1 ${isEmpty ? 'text-xl text-gray-600' : 'text-3xl text-white'}`}>{value}</p>
      <p className="text-sm font-medium text-gray-300 mb-0.5">{label}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function AgentStatusDot({ color }: { color: 'green' | 'yellow' | 'red' }) {
  const cls = color === 'green' ? 'bg-green-400' : color === 'yellow' ? 'bg-yellow-400' : 'bg-red-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}

const envColors: Record<string, string> = {
  PRODUCTION: 'badge-green',
  STAGING: 'badge-yellow',
  DEVELOPMENT: 'badge-blue',
};

const DAYS_OPTIONS = [7, 30, 90] as const;
type DaysOption = typeof DAYS_OPTIONS[number];

// Custom tooltip for recharts
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.name === 'Cost ($)' ? `$${p.value.toFixed(4)}` : p.value}
        </p>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const user = getUser();
  const [chartDays, setChartDays] = useState<DaysOption>(30);

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions').then((r) => r.data),
  });

  const { data: evalRuns = [] } = useQuery<EvalRun[]>({
    queryKey: ['eval-runs'],
    queryFn: () => api.get('/evals/runs').then((r) => r.data),
  });

  const { data: driftReports = [] } = useQuery<DriftReport[]>({
    queryKey: ['drift-reports'],
    queryFn: () => api.get('/drift/reports').then((r) => r.data),
  });

  const { data: violations = [] } = useQuery<Violation[]>({
    queryKey: ['violations'],
    queryFn: () => api.get('/policies/violations').then((r) => r.data),
  });

  const { data: timeseries = [] } = useQuery<TimeseriesPoint[]>({
    queryKey: ['analytics-timeseries', chartDays],
    queryFn: () => api.get('/analytics/timeseries', { params: { days: chartDays } }).then((r) => r.data),
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

  // ── KPI calculations ────────────────────────────────────────────────────────
  const activeAgents = agents.filter((a) => a.status === 'ACTIVE').length;

  const conversationsToday = sessions.filter((s) => isToday(new Date(s.startedAt))).length;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentRuns = evalRuns.filter(
    (r) => r.passRate != null && r.completedAt && new Date(r.completedAt) >= sevenDaysAgo,
  );
  const avgQuality =
    recentRuns.length > 0
      ? Math.round(recentRuns.reduce((acc, r) => acc + (r.passRate ?? 0), 0) / recentRuns.length * 100)
      : null;

  const monthStart = startOfMonth(new Date());
  const costThisMonth = sessions
    .filter((s) => new Date(s.startedAt) >= monthStart && s.costUsd != null)
    .reduce((acc, s) => acc + (s.costUsd ?? 0), 0);

  // ── Agent health table ──────────────────────────────────────────────────────
  type AgentRow = {
    agent: Agent;
    sessions7d: Session[];
    lastActive: Date | null;
    avgLatency: number | null;
    cost7d: number;
    health: 'green' | 'yellow' | 'red';
  };

  const agentRows: AgentRow[] = agents.map((agent) => {
    const agentSessions = sessions.filter((s) => s.agent?.id === agent.id);
    const sessions7d = agentSessions.filter((s) => new Date(s.startedAt) >= sevenDaysAgo);
    const lastActiveSession = agentSessions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )[0];
    const lastActive = lastActiveSession ? new Date(lastActiveSession.startedAt) : null;

    const latencies = sessions7d.filter((s) => s.totalLatencyMs != null).map((s) => s.totalLatencyMs!);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

    const cost7d = sessions7d.filter((s) => s.costUsd != null).reduce((acc, s) => acc + (s.costUsd ?? 0), 0);

    let health: 'green' | 'yellow' | 'red' = 'green';
    if (agent.status !== 'ACTIVE') health = 'red';
    else if (sessions7d.length === 0) health = 'yellow';

    return { agent, sessions7d, lastActive, avgLatency, cost7d, health };
  });

  // ── Alerts ──────────────────────────────────────────────────────────────────
  type AlertItem = { id: string; label: string; severity: string; time: string };
  const alerts: AlertItem[] = [
    ...driftReports
      .filter((d) => !d.resolvedAt)
      .map((d) => ({
        id: `drift-${d.id}`,
        label: `Drift detected — ${d.agent.name}`,
        severity: d.severity,
        time: d.createdAt,
      })),
    ...violations
      .filter((v) => !v.resolvedAt)
      .map((v) => ({
        id: `violation-${v.id}`,
        label: `Policy violation — ${v.policy.name}`,
        severity: v.severity,
        time: v.createdAt,
      })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const recentSessions = sessions.slice(0, 5);

  // Chart: label every 7th date for readability
  const chartData = timeseries.map((pt, i) => ({
    ...pt,
    'Cost ($)': pt.costUsd,
    Conversations: pt.conversations,
    label: i % Math.max(1, Math.floor(timeseries.length / 7)) === 0
      ? pt.date.slice(5)  // "MM-DD"
      : '',
  }));

  const hasChartData = timeseries.some((pt) => pt.conversations > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-gray-400 mt-1">Here's what your AI agents are doing for your business</p>
      </div>

      {/* ── Onboarding Checklist ─────────────────────────────────────────────── */}
      <OnboardingChecklist
        agentCount={overview?.agents ?? agents.length}
        apiKeyCount={apiKeys.length}
        sessionCount={overview?.sessions ?? sessions.length}
      />

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => <div key={i} className="card animate-pulse h-32 bg-gray-900/50" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            icon={Bot}
            label="Active Agents"
            value={activeAgents}
            subtitle="agents running in production"
            color="bg-brand-600/20 text-brand-400"
          />
          <KpiCard
            icon={MessageSquare}
            label="Conversations Today"
            value={conversationsToday}
            subtitle="user interactions"
            color="bg-blue-900/40 text-blue-400"
          />
          <KpiCard
            icon={TrendingUp}
            label="Avg Response Quality"
            value={avgQuality != null ? `${avgQuality}%` : 'No data yet'}
            subtitle="based on recent evaluations"
            color="bg-purple-900/40 text-purple-400"
            isEmpty={avgQuality == null}
          />
          <KpiCard
            icon={DollarSign}
            label="Est. Cost This Month"
            value={`$${costThisMonth.toFixed(2)}`}
            subtitle="across all agents"
            color="bg-green-900/40 text-green-400"
          />
        </div>
      )}

      {/* ── Time-series Chart ──────────────────────────────────────────────── */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Conversation Volume & Cost</h2>
          <div className="flex gap-1 bg-gray-800/60 p-1 rounded-lg border border-gray-700">
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setChartDays(d)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  chartDays === d ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {!hasChartData ? (
          <div className="h-40 flex items-center justify-center text-gray-600 text-sm">
            No conversation data yet. Start logging sessions to see trends.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6d28d9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6d28d9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
              <Area yAxisId="left" type="monotone" dataKey="Conversations" stroke="#7c3aed" strokeWidth={2} fill="url(#colorConv)" dot={false} />
              <Area yAxisId="right" type="monotone" dataKey="Cost ($)" stroke="#10b981" strokeWidth={2} fill="url(#colorCost)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Agent Health Table ────────────────────────────────────────────────── */}
      <div className="card mb-6">
        <h2 className="text-base font-semibold text-white mb-4">Agent Health</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : agentRows.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No agents yet. <Link to="/agents" className="text-brand-400 hover:text-brand-300">Create your first agent →</Link></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Agent</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Conversations (7d)</th>
                  <th className="table-header">Avg Latency</th>
                  <th className="table-header">Est. Cost (7d)</th>
                  <th className="table-header">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {agentRows.map(({ agent, sessions7d, lastActive, avgLatency, cost7d, health }) => (
                  <tr
                    key={agent.id}
                    className="table-row cursor-pointer"
                    onClick={() => window.location.assign(`/agents/${agent.id}`)}
                  >
                    <td className="table-cell font-medium text-white">{agent.name}</td>
                    <td className="table-cell">
                      <span className="flex items-center gap-2">
                        <AgentStatusDot color={health} />
                        <span className="text-xs text-gray-400">
                          {health === 'green' ? 'Healthy' : health === 'yellow' ? 'No recent activity' : 'Inactive'}
                        </span>
                      </span>
                    </td>
                    <td className="table-cell">{sessions7d.length}</td>
                    <td className="table-cell text-xs">
                      {avgLatency != null
                        ? avgLatency < 1000
                          ? `${avgLatency}ms`
                          : `${(avgLatency / 1000).toFixed(1)}s`
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

      {/* ── Bottom panels ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Recent Conversations</h2>
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
