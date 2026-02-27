import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { ClipboardList, Download } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog { id: string; action: string; resourceType: string; resourceId: string | null; ipAddress: string | null; createdAt: string; user: { name: string; email: string } | null; }

export function AuditPage() {
  const [search, setSearch] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [limit, setLimit] = useState(50);

  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ['audit', search, resourceType, limit],
    queryFn: () => api.get('/audit', { params: { action: search || undefined, resourceType: resourceType || undefined, limit } }).then((r) => r.data),
  });

  const logs = data?.logs ?? [];

  function handleExport() {
    window.open('/api/audit/export', '_blank');
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Immutable record of all platform actions"
        action={<button onClick={handleExport} className="btn-secondary flex items-center gap-2"><Download className="w-4 h-4" /> Export NDJSON</button>}
      />

      <div className="flex gap-3 mb-6">
        <input
          className="input max-w-xs"
          placeholder="Filter by action…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-xs" value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
          <option value="">All resource types</option>
          <option value="Agent">Agent</option>
          <option value="AgentVersion">Version</option>
          <option value="Environment">Environment</option>
          <option value="AgentConfig">Config</option>
          <option value="EvalRun">Eval Run</option>
          <option value="DriftReport">Drift Report</option>
          <option value="Session">Session</option>
          <option value="Policy">Policy</option>
          <option value="Integration">Integration</option>
        </select>
      </div>

      {data && <p className="text-xs text-gray-500 mb-3">{data.total.toLocaleString()} total entries</p>}

      {isLoading ? <div className="text-gray-500 text-sm">Loading…</div> :
        logs.length === 0 ? <EmptyState icon={ClipboardList} title="No audit entries" description="Actions will appear here as you use the platform." /> :
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Time</th>
                <th className="table-header">User</th>
                <th className="table-header">Action</th>
                <th className="table-header">Resource</th>
                <th className="table-header">Resource ID</th>
                <th className="table-header">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="table-row">
                  <td className="table-cell text-xs text-gray-500">{format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}</td>
                  <td className="table-cell text-sm">{log.user?.name ?? <span className="text-gray-600">System</span>}</td>
                  <td className="table-cell"><code className="text-xs font-mono text-brand-400">{log.action}</code></td>
                  <td className="table-cell text-gray-400 text-xs">{log.resourceType}</td>
                  <td className="table-cell"><code className="text-xs font-mono text-gray-500">{log.resourceId?.slice(0, 8) ?? '—'}</code></td>
                  <td className="table-cell text-xs text-gray-600">{log.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.total ?? 0) > limit && (
            <div className="text-center pt-4">
              <button onClick={() => setLimit(limit + 50)} className="btn-secondary text-sm">Load more</button>
            </div>
          )}
        </div>
      }
    </div>
  );
}
