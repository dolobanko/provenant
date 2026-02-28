import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { Activity, Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface DriftReport { id: string; driftScore: number; severity: string; resolvedAt: string | null; createdAt: string; agent: { name: string }; environment: { name: string } | null; dimensions: Record<string, unknown>; }

export function DriftPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ agentId: '', environmentId: '', driftScore: '0', severity: 'LOW', dimensions: '{}' });
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');

  const { data: reports = [], isLoading } = useQuery<DriftReport[]>({
    queryKey: ['drift-reports'],
    queryFn: () => api.get('/drift/reports').then((r) => r.data),
  });
  const { data: agents = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ['agents'], queryFn: () => api.get('/agents').then((r) => r.data) });
  const { data: envs = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ['environments'], queryFn: () => api.get('/environments').then((r) => r.data) });

  const create = useMutation({
    mutationFn: (body: object) => api.post('/drift/reports', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drift-reports'] }); setOpen(false); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => api.post(`/drift/reports/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drift-reports'] }),
  });

  const filtered = reports.filter((r) => {
    if (filter === 'OPEN') return !r.resolvedAt;
    if (filter === 'RESOLVED') return !!r.resolvedAt;
    return true;
  });

  const severityColor: Record<string, string> = { LOW: 'text-green-400', MEDIUM: 'text-yellow-400', HIGH: 'text-orange-400', CRITICAL: 'text-red-400' };

  return (
    <div>
      <PageHeader
        title="Drift Detection"
        description="Monitor agent behavior drift across versions"
        action={<button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Report Drift</button>}
      />

      <div className="flex gap-2 mb-6">
        {(['ALL', 'OPEN', 'RESOLVED'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'btn-primary' : 'btn-secondary'}>{f}</button>
        ))}
      </div>

      {isLoading ? <div className="text-gray-500 text-sm">Loading…</div> :
        filtered.length === 0 ? <EmptyState icon={Activity} title="No drift reports" description="Drift reports appear here when agent behavior deviates from baseline." /> :
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="card flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-sm font-bold ${severityColor[r.severity]}`}>{r.severity}</span>
                  <span className="text-sm font-medium text-white">{r.agent?.name}</span>
                  {r.environment && <span className="badge badge-gray">{r.environment.name}</span>}
                  {r.resolvedAt && <span className="badge badge-green">Resolved</span>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Drift score: <span className="text-white font-medium">{r.driftScore.toFixed(1)}</span></span>
                  <span>{format(new Date(r.createdAt), 'MMM d, yyyy HH:mm')}</span>
                </div>
                {Object.keys(r.dimensions ?? {}).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(r.dimensions).map(([k, v]) => (
                      <span key={k} className="text-xs bg-gray-800 rounded px-2 py-0.5 text-gray-400">
                        {k}: {typeof v === 'number' ? v.toFixed(2) : String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {!r.resolvedAt && (
                <button onClick={() => resolve.mutate(r.id)} className="btn-secondary flex items-center gap-1 text-xs flex-shrink-0">
                  <CheckCircle className="w-3 h-3" /> Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      }

      <Modal open={open} onClose={() => setOpen(false)} title="Report Drift">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); try { create.mutate({ ...form, driftScore: parseFloat(form.driftScore), dimensions: JSON.parse(form.dimensions), environmentId: form.environmentId || undefined }); } catch { setError('Invalid JSON in dimensions'); } }} className="space-y-4">
          <div><label className="label">Agent</label><select className="input" value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} required><option value="">Select…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <div><label className="label">Environment (optional)</label><select className="input" value={form.environmentId} onChange={(e) => setForm({ ...form, environmentId: e.target.value })}><option value="">None</option>{envs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
          <div><label className="label">Drift Score (0–100)</label><input type="number" className="input" min={0} max={100} step={0.1} value={form.driftScore} onChange={(e) => setForm({ ...form, driftScore: e.target.value })} required /></div>
          <div><label className="label">Severity</label><select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></div>
          <div><label className="label">Dimensions (JSON)</label><textarea className="input font-mono text-xs" rows={3} value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} /></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">{create.isPending ? 'Reporting…' : 'Report'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
