import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ArrowLeft, Check, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface RunDetail {
  id: string; status: string; score: number; passRate: number; startedAt: string; completedAt: string; costUsd?: number | null;
  agent: { name: string }; suite: { name: string }; agentVersion: { semver: string } | null; environment: { name: string } | null;
  results: { id: string; passed: boolean; score: number; latencyMs: number; tokenCount: number; error: string; case: { name: string } }[];
}

export function EvalRunPage() {
  const { id } = useParams<{ id: string }>();
  const { data: run, isLoading } = useQuery<RunDetail>({
    queryKey: ['eval-run', id],
    queryFn: () => api.get(`/evals/runs/${id}`).then((r) => r.data),
    refetchInterval: (q) => (q.state.data?.status === 'RUNNING' || q.state.data?.status === 'QUEUED' ? 2000 : false),
  });

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>;
  if (!run) return <div className="text-red-400 text-sm">Run not found</div>;

  const chartData = run.results?.slice(0, 20).map((r) => ({ name: r.case?.name?.slice(0, 15), score: r.score ?? 0 }));

  return (
    <div>
      <Link to="/evals" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Evaluations
      </Link>
      <PageHeader title={`Run: ${run.agent?.name}`} description={`Suite: ${run.suite?.name}`} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="card text-center"><StatusBadge status={run.status} /><p className="text-xs text-gray-500 mt-1">Status</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{run.score != null ? run.score.toFixed(1) : '—'}</p><p className="text-xs text-gray-500">Avg Score</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{run.passRate != null ? `${(run.passRate * 100).toFixed(0)}%` : '—'}</p><p className="text-xs text-gray-500">Pass Rate</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{run.results?.length ?? 0}</p><p className="text-xs text-gray-500">Cases</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{run.costUsd != null ? `$${run.costUsd.toFixed(4)}` : '—'}</p><p className="text-xs text-gray-500">Est. Cost</p></div>
      </div>

      {chartData?.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Score Distribution</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="score" fill="#4f6ef7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {run.results?.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="text-sm font-semibold text-white mb-4">Case Results</h2>
          <table className="w-full">
            <thead><tr><th className="table-header">Case</th><th className="table-header">Passed</th><th className="table-header">Score</th><th className="table-header">Latency</th><th className="table-header">Tokens</th><th className="table-header">Error</th></tr></thead>
            <tbody>
              {run.results.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-medium text-white">{r.case?.name}</td>
                  <td className="table-cell">{r.passed ? <Check className="w-4 h-4 text-green-400" /> : <X className="w-4 h-4 text-red-400" />}</td>
                  <td className="table-cell">{r.score != null ? r.score.toFixed(1) : '—'}</td>
                  <td className="table-cell">{r.latencyMs != null ? `${r.latencyMs}ms` : '—'}</td>
                  <td className="table-cell">{r.tokenCount ?? '—'}</td>
                  <td className="table-cell text-xs text-red-400">{r.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
