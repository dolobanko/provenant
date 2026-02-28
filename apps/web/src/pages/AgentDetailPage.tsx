import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton } from '../components/Skeleton';
import { Bot, Plus, ArrowLeft, Check, AlertTriangle, GitCompare, Cpu, ExternalLink } from 'lucide-react';
import { QuickStart } from '../components/QuickStart';
import { format, formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Version { id: string; version: string; semver: string; changelog: string; status: string; modelId: string; systemPrompt?: string; publishedAt: string; createdAt: string; }
interface Agent { id: string; name: string; slug: string; description: string; tags: string[]; status: string; modelFamily: string; versions: Version[]; _count: { versions: number; sessions: number; evalRuns: number }; }

type DiffLine = { type: 'add' | 'remove' | 'same'; line: string };

// ── Agent Trace types ──────────────────────────────────────────────────────────

interface AgentTraceItem {
  id: string;
  traceId: string;
  toolName: string | null;
  toolVersion: string | null;
  vcsRevision: string | null;
  fileCount: number;
  createdAt: string;
  agentVersion: { semver: string; version: string; agentId: string } | null;
}

interface FileAttr {
  path: string;
  attributions: {
    model: string;
    aiLines?: number;
    humanLines?: number;
    mixedLines?: number;
    conversationUrl?: string;
  }[];
}

interface AgentTraceFullDetail {
  id: string;
  traceId: string;
  files: FileAttr[];
  toolName: string | null;
  vcsRevision: string | null;
  createdAt: string;
}

// ── Inline trace detail component ─────────────────────────────────────────────

function TraceInlineDetail({ traceId }: { traceId: string }) {
  const { data, isLoading } = useQuery<AgentTraceFullDetail>({
    queryKey: ['agent-trace', traceId],
    queryFn: () => api.get(`/agent-traces/${traceId}`).then((r) => r.data),
  });

  if (isLoading) return <div className="p-3"><Skeleton className="h-24" /></div>;
  if (!data) return null;

  const modelStats: Record<string, { aiLines: number; files: number; urls: string[] }> = {};
  for (const file of data.files) {
    for (const attr of file.attributions) {
      if (!modelStats[attr.model]) modelStats[attr.model] = { aiLines: 0, files: 0, urls: [] };
      modelStats[attr.model].aiLines += attr.aiLines ?? 0;
      modelStats[attr.model].files++;
      if (attr.conversationUrl) modelStats[attr.model].urls.push(attr.conversationUrl);
    }
  }

  const totalAiLines = Object.values(modelStats).reduce((s, m) => s + m.aiLines, 0);
  const totalHumanLines = data.files.reduce(
    (sum, f) => sum + f.attributions.reduce((s, a) => s + (a.humanLines ?? 0), 0), 0,
  );
  const totalLines = totalAiLines + totalHumanLines;
  const aiPct = totalLines > 0 ? Math.round((totalAiLines / totalLines) * 100) : 0;
  const conversationUrls = Object.values(modelStats).flatMap((s) => s.urls);

  return (
    <div className="bg-gray-900/60 rounded-lg p-4 space-y-4">
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <div><span className="text-gray-500">Files: </span><span className="text-white font-medium">{data.files.length}</span></div>
        <div><span className="text-gray-500">AI: </span><span className="text-brand-400 font-medium">{aiPct}%</span></div>
        <div><span className="text-gray-500">AI Lines: </span><span className="text-white font-medium">{totalAiLines.toLocaleString()}</span></div>
        {totalHumanLines > 0 && (
          <div><span className="text-gray-500">Human Lines: </span><span className="text-white font-medium">{totalHumanLines.toLocaleString()}</span></div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Model breakdown */}
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Model Breakdown</h5>
          {Object.keys(modelStats).length === 0 ? (
            <p className="text-xs text-gray-600">No attribution data.</p>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(modelStats).map(([model, stats]) => (
                <div key={model} className="flex items-center justify-between bg-gray-800/50 rounded px-2.5 py-1.5">
                  <div>
                    <p className="text-xs font-mono text-gray-200">{model}</p>
                    <p className="text-xs text-gray-600">{stats.files} file{stats.files !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm font-bold text-white ml-4">{stats.aiLines.toLocaleString()} <span className="text-xs font-normal text-gray-500">lines</span></span>
                </div>
              ))}
            </div>
          )}
          {/* Conversation URLs */}
          {conversationUrls.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Conversation Links</p>
              {conversationUrls.slice(0, 4).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 truncate"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{url}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* File list */}
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Files ({data.files.length})</h5>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {data.files.length === 0 ? (
              <p className="text-xs text-gray-600">No file attributions recorded.</p>
            ) : (
              data.files.map((file) => {
                const ai = file.attributions.reduce((s, a) => s + (a.aiLines ?? 0), 0);
                const human = file.attributions.reduce((s, a) => s + (a.humanLines ?? 0), 0);
                const total = ai + human;
                const pct = total > 0 ? Math.round((ai / total) * 100) : 0;
                return (
                  <div key={file.path}>
                    <p className="text-xs font-mono text-gray-400 truncate mb-0.5">{file.path}</p>
                    {total > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0">{pct}% AI</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Authorship tab ──────────────────────────────────────────────────────────

function AgentAuthorshipTab({ agentId, versions }: { agentId: string; versions: Version[] }) {
  const [selectedVersionId, setSelectedVersionId] = useState<string>(versions[0]?.id ?? '');
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  const { data: traces = [], isLoading } = useQuery<AgentTraceItem[]>({
    queryKey: ['agent-traces', selectedVersionId || agentId],
    queryFn: async () => {
      if (selectedVersionId) {
        return api.get('/agent-traces', { params: { agentVersionId: selectedVersionId } }).then((r) => r.data);
      }
      // All versions: fetch all org traces and filter by agentId
      const all = await api.get('/agent-traces').then((r) => r.data as AgentTraceItem[]);
      return all.filter((t) => t.agentVersion?.agentId === agentId);
    },
    enabled: true,
  });

  const totalFiles = traces.reduce((s, t) => s + t.fileCount, 0);

  return (
    <div className="space-y-4">
      {/* Version selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-500">Version:</label>
        <select
          value={selectedVersionId}
          onChange={(e) => { setSelectedVersionId(e.target.value); setExpandedTraceId(null); }}
          className="input py-1 text-xs w-48"
        >
          <option value="">All Versions</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>v{v.semver} — {v.version}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : traces.length === 0 ? (
        <div className="text-center py-10 text-gray-600">
          <Cpu className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No AI authorship traces yet.</p>
          <p className="text-xs mt-1">
            Ingest traces via{' '}
            <code className="bg-gray-800 px-1 rounded">POST /api/agent-traces</code>
            {' '}or webhook with{' '}
            <code className="bg-gray-800 px-1 rounded">x-agent-trace: true</code>
          </p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap gap-4 p-3 bg-gray-900/50 rounded-lg text-sm">
            <div><span className="text-gray-500">Traces: </span><span className="text-white font-medium">{traces.length}</span></div>
            <div><span className="text-gray-500">Total Files: </span><span className="text-white font-medium">{totalFiles}</span></div>
          </div>

          {/* Traces list */}
          <div className="space-y-2">
            {traces.map((t) => (
              <div key={t.id} className="border border-gray-800 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-900/40 hover:bg-gray-900/70 transition-colors text-left"
                  onClick={() => setExpandedTraceId(expandedTraceId === t.id ? null : t.id)}
                >
                  <Cpu className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  <span className="text-xs font-mono text-gray-300 flex-1 truncate">
                    {t.traceId.length > 24 ? `${t.traceId.slice(0, 24)}…` : t.traceId}
                  </span>
                  {t.toolName && (
                    <span className="text-xs text-gray-500">{t.toolName}{t.toolVersion ? ` ${t.toolVersion}` : ''}</span>
                  )}
                  <span className="text-xs text-gray-600 flex-shrink-0">{t.fileCount} file{t.fileCount !== 1 ? 's' : ''}</span>
                  {t.vcsRevision && (
                    <span className="text-xs font-mono text-gray-600 flex-shrink-0">{t.vcsRevision.slice(0, 8)}</span>
                  )}
                  <span className="text-xs text-gray-600 flex-shrink-0" title={format(new Date(t.createdAt), 'PPpp')}>
                    {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                  </span>
                </button>
                {expandedTraceId === t.id && (
                  <div className="border-t border-gray-800">
                    <TraceInlineDetail traceId={t.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Diff helper ────────────────────────────────────────────────────────────────

function computeDiff(textA: string, textB: string): DiffLine[] {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  if (linesA.length > 500 || linesB.length > 500) {
    return [
      ...linesA.map((line): DiffLine => ({ type: 'remove', line })),
      ...linesB.map((line): DiffLine => ({ type: 'add', line })),
    ];
  }
  const m = linesA.length, n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = linesA[i - 1] === linesB[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  let i = m, j = n;
  const backtrack: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      backtrack.push({ type: 'same', line: linesA[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      backtrack.push({ type: 'add', line: linesB[j - 1] }); j--;
    } else {
      backtrack.push({ type: 'remove', line: linesA[i - 1] }); i--;
    }
  }
  return backtrack.reverse();
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffVersions, setDiffVersions] = useState<{ a: Version | null; b: Version | null }>({ a: null, b: null });
  const [vForm, setVForm] = useState({ version: '', semver: '', changelog: '', modelId: '', systemPrompt: '' });
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'versions' | 'authorship'>('versions');

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: () => api.get(`/agents/${id}`).then((r) => r.data),
  });

  const createVersion = useMutation({
    mutationFn: (body: object) => api.post(`/agents/${id}/versions`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent', id] }); setOpen(false); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const publishVersion = useMutation({
    mutationFn: (vId: string) => api.post(`/agents/${id}/versions/${vId}/publish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', id] }),
  });

  const deprecateVersion = useMutation({
    mutationFn: (vId: string) => api.post(`/agents/${id}/versions/${vId}/deprecate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', id] }),
  });

  // Eval trend for this agent
  interface EvalRunItem { id: string; passRate: number | null; completedAt: string | null; agentVersion: { semver: string } | null; }
  const { data: evalRuns = [] } = useQuery<EvalRunItem[]>({
    queryKey: ['eval-runs', id],
    queryFn: () => api.get('/evals/runs', { params: { agentId: id } }).then((r) => r.data),
    enabled: !!id,
  });

  // Health score
  interface DriftItem { id: string; severity: string; resolvedAt: string | null; }
  interface ViolationItem { id: string; severity: string; resolvedAt: string | null; }
  const { data: agentDrift = [] } = useQuery<DriftItem[]>({
    queryKey: ['agent-drift', id],
    queryFn: () => api.get('/drift/reports', { params: { agentId: id } }).then((r) => r.data),
    enabled: !!id,
  });
  const { data: agentViolations = [] } = useQuery<ViolationItem[]>({
    queryKey: ['agent-violations', id],
    queryFn: () => api.get('/policies/violations', { params: { agentId: id } }).then((r) => r.data),
    enabled: !!id,
  });
  const healthScore = (() => {
    let score = 100;
    for (const d of agentDrift.filter((d) => !d.resolvedAt)) {
      if (d.severity === 'CRITICAL' || d.severity === 'HIGH') score -= 30;
      else if (d.severity === 'MEDIUM') score -= 15;
      else score -= 5;
    }
    for (const v of agentViolations.filter((v) => !v.resolvedAt)) {
      if (v.severity === 'HIGH' || v.severity === 'CRITICAL') score -= 20;
      else if (v.severity === 'MEDIUM') score -= 10;
      else score -= 5;
    }
    return Math.max(0, score);
  })();
  const healthColor = healthScore >= 80 ? 'text-green-400 bg-green-900/30 border-green-800/40'
    : healthScore >= 50 ? 'text-yellow-400 bg-yellow-900/30 border-yellow-800/40'
    : 'text-red-400 bg-red-900/30 border-red-800/40';
  const healthDot = healthScore >= 80 ? 'bg-green-400' : healthScore >= 50 ? 'bg-yellow-400' : 'bg-red-400';

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>;
  if (!agent) return <div className="text-red-400 text-sm">Agent not found</div>;

  function openDiff(v: Version) {
    const idx = agent!.versions.findIndex((v2) => v2.id === v.id);
    const prev = agent!.versions[idx + 1] ?? null;
    setDiffVersions({ a: prev, b: v });
    setDiffOpen(true);
  }

  const diffLines = diffVersions.a && diffVersions.b
    ? computeDiff(diffVersions.a.systemPrompt ?? '', diffVersions.b.systemPrompt ?? '')
    : [];

  return (
    <div>
      <Link to="/agents" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Agents
      </Link>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${healthColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${healthDot}`} />
              {healthScore} / 100
            </span>
          </div>
          {agent.description && <p className="text-sm text-gray-400 mt-1">{agent.description}</p>}
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" /> New Version
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center"><p className="text-2xl font-bold text-white">{agent._count.versions}</p><p className="text-sm text-gray-400">Versions</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{agent._count.sessions}</p><p className="text-sm text-gray-400">Sessions</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{agent._count.evalRuns}</p><p className="text-sm text-gray-400">Eval Runs</p></div>
      </div>

      <QuickStart agentId={agent.id} />

      {/* Versions + AI Authorship card */}
      <div className="card">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-gray-800 -mx-5 px-5 mb-5">
          <button
            onClick={() => setActiveTab('versions')}
            className={clsx(
              'flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'versions'
                ? 'border-brand-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300',
            )}
          >
            <Bot className="w-3.5 h-3.5" />
            Versions
          </button>
          <button
            onClick={() => setActiveTab('authorship')}
            className={clsx(
              'flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'authorship'
                ? 'border-brand-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300',
            )}
          >
            <Cpu className="w-3.5 h-3.5" />
            AI Authorship
          </button>
        </div>

        {/* Versions tab */}
        {activeTab === 'versions' && (
          agent.versions.length === 0 ? (
            <p className="text-sm text-gray-500">No versions yet.</p>
          ) : (
            <table className="w-full">
              <thead><tr><th className="table-header">Version</th><th className="table-header">Semver</th><th className="table-header">Status</th><th className="table-header">Published</th><th className="table-header">Actions</th></tr></thead>
              <tbody>
                {agent.versions.map((v) => (
                  <tr key={v.id} className="table-row">
                    <td className="table-cell font-medium text-white">{v.version}</td>
                    <td className="table-cell font-mono text-xs">{v.semver}</td>
                    <td className="table-cell"><StatusBadge status={v.status} /></td>
                    <td className="table-cell text-xs">{v.publishedAt ? format(new Date(v.publishedAt), 'MMM d, yyyy') : '—'}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        {v.status === 'DRAFT' && (
                          <button onClick={() => publishVersion.mutate(v.id)} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Publish
                          </button>
                        )}
                        {v.status === 'PUBLISHED' && (
                          <button onClick={() => deprecateVersion.mutate(v.id)} className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Deprecate
                          </button>
                        )}
                        <button
                          onClick={() => openDiff(v)}
                          className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                          title="Compare with previous version"
                        >
                          <GitCompare className="w-3 h-3" /> Diff
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* Eval trend chart — shown inside Versions tab when data available */}
        {activeTab === 'versions' && (() => {
          const completedRuns = evalRuns
            .filter((r) => r.passRate != null && r.completedAt)
            .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime())
            .slice(-20)
            .map((r) => ({
              date: new Date(r.completedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              passRate: Math.round((r.passRate ?? 0) * 100),
              semver: r.agentVersion?.semver ?? 'unknown',
            }));
          if (completedRuns.length === 0) return null;
          return (
            <div className="mt-6 border-t border-gray-800 pt-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Eval Pass Rate Trend</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={completedRuns} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, 'Pass Rate']}
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Line type="monotone" dataKey="passRate" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {/* AI Authorship tab */}
        {activeTab === 'authorship' && (
          <AgentAuthorshipTab agentId={agent.id} versions={agent.versions} />
        )}
      </div>

      {/* New Version Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Version">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); createVersion.mutate(vForm); }} className="space-y-4">
          <div><label className="label">Label (e.g. "v2 with tools")</label><input className="input" value={vForm.version} onChange={(e) => setVForm({ ...vForm, version: e.target.value })} required /></div>
          <div><label className="label">Semver (e.g. 1.0.0)</label><input className="input" placeholder="1.0.0" value={vForm.semver} onChange={(e) => setVForm({ ...vForm, semver: e.target.value })} required /></div>
          <div><label className="label">Model ID</label><input className="input" placeholder="claude-sonnet-4-5" value={vForm.modelId} onChange={(e) => setVForm({ ...vForm, modelId: e.target.value })} /></div>
          <div><label className="label">System prompt</label><textarea className="input" rows={3} value={vForm.systemPrompt} onChange={(e) => setVForm({ ...vForm, systemPrompt: e.target.value })} /></div>
          <div><label className="label">Changelog</label><textarea className="input" rows={2} value={vForm.changelog} onChange={(e) => setVForm({ ...vForm, changelog: e.target.value })} /></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createVersion.isPending} className="btn-primary flex-1">{createVersion.isPending ? 'Creating…' : 'Create Version'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Diff Modal */}
      <Modal open={diffOpen} onClose={() => setDiffOpen(false)} title={`Diff: ${diffVersions.b?.version ?? ''}`} size="lg">
        {!diffVersions.a ? (
          <p className="text-sm text-gray-400">No previous version to compare against.</p>
        ) : (
          <div>
            <div className="flex items-center gap-6 mb-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-900/60 inline-block" />
                Removed ({diffVersions.a.semver})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-green-900/60 inline-block" />
                Added ({diffVersions.b?.semver})
              </span>
            </div>
            {diffLines.every((l) => l.type === 'same') && (
              <p className="text-xs text-gray-500 mb-3">System prompts are identical.</p>
            )}
            <pre className="text-xs font-mono leading-5 bg-gray-950 rounded-lg p-3 max-h-[60vh] overflow-y-auto overflow-x-auto">
              {diffLines.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.type === 'add' ? 'bg-green-900/30 text-green-300' :
                    line.type === 'remove' ? 'bg-red-900/30 text-red-400 line-through' :
                    'text-gray-500'
                  }
                >
                  <span className="select-none mr-3 text-gray-700">
                    {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                  </span>
                  {line.line || ' '}
                </div>
              ))}
              {diffLines.length === 0 && <span className="text-gray-600">No system prompt content.</span>}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
