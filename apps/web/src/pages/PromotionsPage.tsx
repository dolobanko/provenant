import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { ArrowUpDown, Plus, Check, X } from 'lucide-react';
import { format } from 'date-fns';

interface Promotion {
  id: string; status: string; notes: string; promotedAt: string; createdAt: string;
  agentVersion: { semver: string; agent: { name: string } };
  toEnv: { name: string; type: string };
  fromEnv: { name: string } | null;
  approvals: { id: string; decision: string; user: { name: string }; comment: string }[];
}

export function PromotionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ agentVersionId: '', fromEnvId: '', toEnvId: '', notes: '' });
  const [error, setError] = useState('');

  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ['promotions'],
    queryFn: () => api.get('/environments/promotions').then((r) => r.data),
  });

  const { data: agents = [] } = useQuery<{ id: string; name: string; versions: { id: string; semver: string }[] }[]>({
    queryKey: ['agents-with-versions'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  });

  const { data: envs = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['environments'],
    queryFn: () => api.get('/environments').then((r) => r.data),
  });

  const [selectedAgent, setSelectedAgent] = useState('');
  const [versions, setVersions] = useState<{ id: string; semver: string }[]>([]);

  const create = useMutation({
    mutationFn: (body: object) => api.post('/environments/promotions', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions'] }); setOpen(false); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const approve = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      api.post(`/environments/promotions/${id}/approve`, { comment }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/environments/promotions/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  });

  async function loadVersions(agentId: string) {
    setSelectedAgent(agentId);
    if (!agentId) { setVersions([]); return; }
    const { data } = await api.get(`/agents/${agentId}/versions`);
    setVersions(data);
  }

  return (
    <div>
      <PageHeader
        title="Promotions"
        description="Promote agent versions across environments"
        action={<button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Promotion</button>}
      />

      {isLoading ? <div className="text-gray-500 text-sm">Loading…</div> :
        promotions.length === 0 ? <EmptyState icon={ArrowUpDown} title="No promotions" description="Promote an agent version to an environment to get started." /> :
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Agent / Version</th>
                <th className="table-header">Route</th>
                <th className="table-header">Status</th>
                <th className="table-header">Approvals</th>
                <th className="table-header">Date</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell">
                    <p className="font-medium text-white">{p.agentVersion?.agent?.name}</p>
                    <p className="text-xs font-mono text-gray-500">{p.agentVersion?.semver}</p>
                  </td>
                  <td className="table-cell text-xs">
                    {p.fromEnv ? <span className="text-gray-400">{p.fromEnv.name} →</span> : null} <span className="text-white">{p.toEnv?.name}</span>
                  </td>
                  <td className="table-cell"><StatusBadge status={p.status} /></td>
                  <td className="table-cell text-xs text-gray-500">{p.approvals?.length ?? 0} decision(s)</td>
                  <td className="table-cell text-xs">{format(new Date(p.createdAt), 'MMM d, yyyy')}</td>
                  <td className="table-cell">
                    {p.status === 'AWAITING_APPROVAL' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => approve.mutate({ id: p.id })} className="text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
                        <button onClick={() => reject.mutate(p.id)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }

      <Modal open={open} onClose={() => setOpen(false)} title="New Promotion">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); create.mutate({ ...form, fromEnvId: form.fromEnvId || undefined }); }} className="space-y-4">
          <div>
            <label className="label">Agent</label>
            <select className="input" value={selectedAgent} onChange={(e) => loadVersions(e.target.value)} required>
              <option value="">Select agent…</option>
              {(agents as { id: string; name: string }[]).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Version</label>
            <select className="input" value={form.agentVersionId} onChange={(e) => setForm({ ...form, agentVersionId: e.target.value })} required>
              <option value="">Select version…</option>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.semver}</option>)}
            </select>
          </div>
          <div>
            <label className="label">From environment (optional)</label>
            <select className="input" value={form.fromEnvId} onChange={(e) => setForm({ ...form, fromEnvId: e.target.value })}>
              <option value="">None</option>
              {(envs as { id: string; name: string }[]).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To environment</label>
            <select className="input" value={form.toEnvId} onChange={(e) => setForm({ ...form, toEnvId: e.target.value })} required>
              <option value="">Select…</option>
              {(envs as { id: string; name: string }[]).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">{create.isPending ? 'Creating…' : 'Promote'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
