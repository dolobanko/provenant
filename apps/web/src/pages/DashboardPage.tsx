import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Bot, Globe, FlaskConical, Activity, MessageSquare, Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getUser } from '../lib/auth';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface TrendPoint { date: string; passRate: number; }
interface VolumePoint { date: string; count: number; }
interface DriftPoint { date: string; LOW?: number; MEDIUM?: number; HIGH?: number; CRITICAL?: number; }

function StatCard({ icon: Icon, label, value, to, color }: { icon: typeof Bot; label: string; value: number | string; to: string; color: string }) {
  return (
    <Link to={to} className="card hover:border-gray-700 transition-colors block">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const user = getUser();
  const { data: agents = [] } = useQuery({ queryKey: ['agents'], queryFn: () => api.get('/agents').then((r) => r.data) });
  const { data: envs = [] } = useQuery({ queryKey: ['environments'], queryFn: () => api.get('/environments').then((r) => r.data) });
  const { data: runs = [] } = useQuery({ queryKey: ['eval-runs'], queryFn: () => api.get('/evals/runs').then((r) => r.data) });
  const { data: driftReports = [] } = useQuery({ queryKey: ['drift-reports'], queryFn: () => api.get('/drift/reports').then((r) => r.data) });
  const { data: sessions = [] } = useQuery({ queryKey: ['sessions'], queryFn: () => api.get('/sessions').then((r) => r.data) });
  const { data: violations = [] } = useQuery({ queryKey: ['violations'], queryFn: () => api.get('/policies/violations').then((r) => r.data) });

  const { data: evalTrend = [] } = useQuery<TrendPoint[]>({
    queryKey: ['analytics-eval-trend'],
    queryFn: () => api.get('/analytics/eval-trend').then((r) => r.data),
  });
  const { data: sessionVolume = [] } = useQuery<VolumePoint[]>({
    queryKey: ['analytics-session-volume'],
    queryFn: () => api.get('/analytics/session-volume').then((r) => r.data),
  });
  const { data: driftHistory = [] } = useQuery<DriftPoint[]>({
    queryKey: ['analytics-drift-history'],
    queryFn: () => api.get('/analytics/drift-history').then((r) => r.data),
  });

  const openDrifts = (driftReports as { resolvedAt: unknown }[]).filter((d) => !d.resolvedAt).length;
  const openViolations = (violations as { resolvedAt: unknown }[]).filter((v) => !v.resolvedAt).length;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0]}`}
        description="AgentOps platform overview"
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Bot} label="Agents" value={(agents as unknown[]).length} to="/agents" color="bg-brand-600/20 text-brand-400" />
        <StatCard icon={Globe} label="Environments" value={(envs as unknown[]).length} to="/environments" color="bg-green-900/40 text-green-400" />
        <StatCard icon={FlaskConical} label="Eval Runs" value={(runs as unknown[]).length} to="/evals" color="bg-purple-900/40 text-purple-400" />
        <StatCard icon={MessageSquare} label="Sessions" value={(sessions as unknown[]).length} to="/sessions" color="bg-blue-900/40 text-blue-400" />
        <StatCard icon={Activity} label="Open Drifts" value={openDrifts} to="/drift" color="bg-yellow-900/40 text-yellow-400" />
        <StatCard icon={Shield} label="Open Violations" value={openViolations} to="/policies" color="bg-red-900/40 text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent eval runs */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h2 className="font-semibold text-white">Recent Eval Runs</h2>
          </div>
          {(runs as { id: string; agent: { name: string }; score: number; passRate: number; status: string }[]).slice(0, 5).length === 0 ? (
            <p className="text-sm text-gray-500">No eval runs yet.</p>
          ) : (
            <div className="space-y-2">
              {(runs as { id: string; agent: { name: string }; score: number; passRate: number; status: string }[]).slice(0, 5).map((run) => (
                <Link key={run.id} to={`/evals/runs/${run.id}`} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{run.agent?.name}</p>
                    <p className="text-xs text-gray-500">
                      Score: {run.score != null ? run.score.toFixed(1) : '—'} · Pass rate: {run.passRate != null ? (run.passRate * 100).toFixed(0) : '—'}%
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">{run.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent drift reports */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h2 className="font-semibold text-white">Drift Reports</h2>
          </div>
          {(driftReports as { id: string; agent: { name: string }; driftScore: number; severity: string; resolvedAt: unknown }[]).slice(0, 5).length === 0 ? (
            <p className="text-sm text-gray-500">No drift reports.</p>
          ) : (
            <div className="space-y-2">
              {(driftReports as { id: string; agent: { name: string }; driftScore: number; severity: string; resolvedAt: unknown }[]).slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{r.agent?.name}</p>
                    <p className="text-xs text-gray-500">Score: {r.driftScore.toFixed(1)}</p>
                  </div>
                  <span className={`text-xs font-medium ${r.severity === 'CRITICAL' ? 'text-red-400' : r.severity === 'HIGH' ? 'text-orange-400' : r.severity === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'}`}>
                    {r.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Eval Pass Rate (30d)</h2>
          {evalTrend.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">No eval data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={evalTrend}>
                <defs>
                  <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="passRate" stroke="#4f6ef7" fill="url(#passGrad)" name="Pass Rate %" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Session Volume (30d)</h2>
          {sessionVolume.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">No session data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={sessionVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#22c55e" radius={[3, 3, 0, 0]} name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Drift by Severity (14d)</h2>
          {driftHistory.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">No drift data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={driftHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#6b7280' }} />
                <Bar dataKey="LOW" stackId="a" fill="#22c55e" name="Low" />
                <Bar dataKey="MEDIUM" stackId="a" fill="#eab308" name="Med" />
                <Bar dataKey="HIGH" stackId="a" fill="#f97316" name="High" />
                <Bar dataKey="CRITICAL" stackId="a" fill="#ef4444" name="Critical" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
