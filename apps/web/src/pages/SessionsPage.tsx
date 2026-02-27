import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

interface Session { id: string; status: string; totalTokens: number; totalLatencyMs: number; startedAt: string; costUsd?: number | null; agent: { name: string }; environment: { name: string } | null; _count: { turns: number }; }

export function SessionsPage() {
  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions').then((r) => r.data),
  });

  return (
    <div>
      <PageHeader title="Sessions" description="AI session capture and replay" />

      {isLoading ? <div className="text-gray-500 text-sm">Loading…</div> :
        sessions.length === 0 ? <EmptyState icon={MessageSquare} title="No sessions" description="Sessions are created via the API when agents are invoked." /> :
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Agent</th>
                <th className="table-header">Environment</th>
                <th className="table-header">Turns</th>
                <th className="table-header">Tokens</th>
                <th className="table-header">Est. Cost</th>
                <th className="table-header">Status</th>
                <th className="table-header">Started</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="table-row">
                  <td className="table-cell font-medium text-white">{s.agent?.name}</td>
                  <td className="table-cell text-gray-400">{s.environment?.name ?? '—'}</td>
                  <td className="table-cell">{s._count.turns}</td>
                  <td className="table-cell">{s.totalTokens?.toLocaleString() ?? '—'}</td>
                  <td className="table-cell text-xs">{s.costUsd != null ? `$${s.costUsd.toFixed(4)}` : '—'}</td>
                  <td className="table-cell"><StatusBadge status={s.status} /></td>
                  <td className="table-cell text-xs">{format(new Date(s.startedAt), 'MMM d, HH:mm')}</td>
                  <td className="table-cell"><Link to={`/sessions/${s.id}`} className="text-brand-400 hover:text-brand-300 text-xs">View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
}
