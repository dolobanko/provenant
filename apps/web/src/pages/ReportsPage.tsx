import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { BarChart2, Download, FileText, Users, ClipboardList } from 'lucide-react';
import { startOfDay, subDays, format } from 'date-fns';
import { Skeleton } from '../components/Skeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Agent { id: string; name: string; }
interface Session {
  id: string;
  startedAt: string;
  costUsd: number | null;
  totalTokens: number | null;
  totalLatencyMs: number | null;
  agent: { name: string; id: string };
  _count: { turns: number };
}
interface EvalRun {
  id: string;
  agentId: string;
  agent: { name: string };
  passRate: number | null;
  completedAt: string | null;
}
interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

type DateRange = '7d' | '30d' | '90d';

function dateRangeStart(range: DateRange): Date {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return startOfDay(subDays(new Date(), days));
}

// ── CSV export ─────────────────────────────────────────────────────────────────

function exportCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function ReportSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof BarChart2;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card mb-6">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-gray-800">
        <div className="w-9 h-9 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-brand-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function RangePicker({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  return (
    <div className="flex gap-1 bg-gray-800/60 p-1 rounded-lg border border-gray-700">
      {(['7d', '30d', '90d'] as DateRange[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === r ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Last {r}
        </button>
      ))}
    </div>
  );
}

// ── Report 1: Conversation Summary ────────────────────────────────────────────

function ConversationSummaryReport({ sessions }: { sessions: Session[] }) {
  const [range, setRange] = useState<DateRange>('30d');
  const cutoff = dateRangeStart(range);

  const filtered = useMemo(
    () => sessions.filter((s) => new Date(s.startedAt) >= cutoff),
    [sessions, cutoff],
  );

  const totalConversations = filtered.length;
  const totalTokens = filtered.reduce((a, s) => a + (s.totalTokens ?? 0), 0);
  const totalCost = filtered.reduce((a, s) => a + (s.costUsd ?? 0), 0);
  const avgTurns =
    totalConversations > 0
      ? (filtered.reduce((a, s) => a + s._count.turns, 0) / totalConversations).toFixed(1)
      : '—';

  // Busiest agent
  const agentCounts: Record<string, { name: string; count: number }> = {};
  for (const s of filtered) {
    if (!agentCounts[s.agent?.id]) agentCounts[s.agent?.id] = { name: s.agent?.name, count: 0 };
    agentCounts[s.agent?.id].count++;
  }
  const busiestAgent =
    Object.values(agentCounts).sort((a, b) => b.count - a.count)[0]?.name ?? '—';

  function handleExport() {
    exportCsv(
      `conversations-${range}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Session ID', 'Agent', 'Started At', 'Turns', 'Tokens', 'Est. Cost (USD)'],
      filtered.map((s) => [
        s.id,
        s.agent?.name,
        s.startedAt,
        s._count.turns,
        s.totalTokens,
        s.costUsd?.toFixed(6),
      ]),
    );
  }

  return (
    <ReportSection
      icon={FileText}
      title="Conversation Summary"
      description="High-level metrics across all conversations in the selected period"
    >
      <div className="flex items-center justify-between mb-5">
        <RangePicker value={range} onChange={setRange} />
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center gap-2 text-xs py-1.5 px-3"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Conversations', value: totalConversations.toLocaleString() },
          { label: 'Total Tokens', value: totalTokens.toLocaleString() },
          { label: 'Total Cost', value: `$${totalCost.toFixed(4)}` },
          { label: 'Avg Session Length', value: `${avgTurns} turns` },
          { label: 'Busiest Agent', value: busiestAgent },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-800/40 rounded-xl p-4 border border-gray-800">
            <p className="text-xl font-bold text-white mb-1 truncate">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

// ── Report 2: Agent Performance ───────────────────────────────────────────────

function AgentPerformanceReport({
  agents,
  sessions,
  evalRuns,
}: {
  agents: Agent[];
  sessions: Session[];
  evalRuns: EvalRun[];
}) {
  type Row = {
    agent: Agent;
    totalSessions: number;
    avgLatency: number | null;
    totalCost: number;
    passRate: number | null;
  };

  const rows: Row[] = agents.map((agent) => {
    const agentSessions = sessions.filter((s) => s.agent?.id === agent.id);
    const latencies = agentSessions.filter((s) => s.totalLatencyMs != null).map((s) => s.totalLatencyMs!);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
    const totalCost = agentSessions.reduce((a, s) => a + (s.costUsd ?? 0), 0);

    const agentRuns = evalRuns.filter((r) => r.agentId === agent.id && r.passRate != null);
    const passRate =
      agentRuns.length > 0
        ? agentRuns.reduce((a, r) => a + (r.passRate ?? 0), 0) / agentRuns.length
        : null;

    return { agent, totalSessions: agentSessions.length, avgLatency, totalCost, passRate };
  });

  return (
    <ReportSection
      icon={Users}
      title="Agent Performance"
      description="Aggregated performance metrics per agent across all time"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No agents yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Agent</th>
                <th className="table-header">Total Sessions</th>
                <th className="table-header">Avg Response Time</th>
                <th className="table-header">Est. Total Cost</th>
                <th className="table-header">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ agent, totalSessions, avgLatency, totalCost, passRate }) => (
                <tr key={agent.id} className="table-row">
                  <td className="table-cell font-medium text-white">{agent.name}</td>
                  <td className="table-cell">{totalSessions.toLocaleString()}</td>
                  <td className="table-cell text-xs">
                    {avgLatency != null
                      ? avgLatency < 1000
                        ? `${avgLatency}ms`
                        : `${(avgLatency / 1000).toFixed(1)}s`
                      : '—'}
                  </td>
                  <td className="table-cell text-xs">${totalCost.toFixed(4)}</td>
                  <td className="table-cell">
                    {passRate != null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full max-w-20">
                          <div
                            className={`h-1.5 rounded-full ${passRate >= 0.8 ? 'bg-green-400' : passRate >= 0.6 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ width: `${passRate * 100}%` }}
                          />
                        </div>
                        <span className="text-xs">{(passRate * 100).toFixed(0)}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">No eval data</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportSection>
  );
}

// ── Report 3: Audit Trail ─────────────────────────────────────────────────────

function AuditTrailReport() {
  const [range, setRange] = useState<DateRange>('7d');

  const { data: audit = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['audit'],
    queryFn: () => api.get('/audit').then((r) => r.data),
  });

  const cutoff = dateRangeStart(range);
  const filtered = useMemo(
    () => audit.filter((e) => new Date(e.createdAt) >= cutoff),
    [audit, cutoff],
  );

  function handleExport() {
    exportCsv(
      `audit-trail-${range}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Timestamp', 'Action', 'Resource', 'Resource ID', 'User'],
      filtered.map((e) => [
        e.createdAt,
        e.action,
        e.resourceType,
        e.resourceId,
        e.user?.email ?? 'System',
      ]),
    );
  }

  return (
    <ReportSection
      icon={ClipboardList}
      title="Audit Trail"
      description="All platform actions and changes for compliance and security review"
    >
      <div className="flex items-center justify-between mb-5">
        <RangePicker value={range} onChange={setRange} />
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center gap-2 text-xs py-1.5 px-3"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No audit entries in the selected period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Timestamp</th>
                <th className="table-header">Action</th>
                <th className="table-header">Resource</th>
                <th className="table-header">Resource ID</th>
                <th className="table-header">User</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((entry) => (
                <tr key={entry.id} className="table-row">
                  <td className="table-cell text-xs font-mono text-gray-400">
                    {format(new Date(entry.createdAt), 'MMM d, HH:mm:ss')}
                  </td>
                  <td className="table-cell">
                    <span className="text-xs font-medium text-gray-200">{entry.action}</span>
                  </td>
                  <td className="table-cell text-xs text-gray-400">{entry.resourceType}</td>
                  <td className="table-cell text-xs font-mono text-gray-600 max-w-xs truncate">
                    {entry.resourceId ? entry.resourceId.slice(0, 8) + '…' : '—'}
                  </td>
                  <td className="table-cell text-xs text-gray-400">
                    {entry.user?.name ?? 'System'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <p className="text-xs text-gray-500 text-center py-3">
              Showing 100 of {filtered.length} entries. Export CSV for full data.
            </p>
          )}
        </div>
      )}
    </ReportSection>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions').then((r) => r.data),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  });

  const { data: evalRuns = [] } = useQuery<EvalRun[]>({
    queryKey: ['eval-runs'],
    queryFn: () => api.get('/evals/runs').then((r) => r.data),
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-sm text-gray-400 mt-1">
          Business intelligence across your AI agents — exportable and shareable
        </p>
      </div>

      {sessionsLoading ? (
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card animate-pulse h-48 bg-gray-900/50" />
          ))}
        </div>
      ) : (
        <>
          <ConversationSummaryReport sessions={sessions} />
          <AgentPerformanceReport agents={agents} sessions={sessions} evalRuns={evalRuns} />
          <AuditTrailReport />
        </>
      )}
    </div>
  );
}
