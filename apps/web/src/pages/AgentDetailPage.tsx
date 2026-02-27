import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { Bot, Plus, ArrowLeft, Check, AlertTriangle, GitCompare } from 'lucide-react';
import { QuickStart } from '../components/QuickStart';
import { format } from 'date-fns';

interface Version { id: string; version: string; semver: string; changelog: string; status: string; modelId: string; systemPrompt?: string; publishedAt: string; createdAt: string; }
interface Agent { id: string; name: string; slug: string; description: string; tags: string[]; status: string; modelFamily: string; versions: Version[]; _count: { versions: number; sessions: number; evalRuns: number }; }

type DiffLine = { type: 'add' | 'remove' | 'same'; line: string };

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

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffVersions, setDiffVersions] = useState<{ a: Version | null; b: Version | null }>({ a: null, b: null });
  const [vForm, setVForm] = useState({ version: '', semver: '', changelog: '', modelId: '', systemPrompt: '' });
  const [error, setError] = useState('');

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
      <PageHeader
        title={agent.name}
        description={agent.description}
        action={<button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Version</button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center"><p className="text-2xl font-bold text-white">{agent._count.versions}</p><p className="text-sm text-gray-400">Versions</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{agent._count.sessions}</p><p className="text-sm text-gray-400">Sessions</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{agent._count.evalRuns}</p><p className="text-sm text-gray-400">Eval Runs</p></div>
      </div>

      <QuickStart agentId={agent.id} />

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-4 h-4 text-brand-400" />
          <h2 className="font-semibold text-white">Versions</h2>
        </div>
        {agent.versions.length === 0 ? (
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
