import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { GitBranch, Plus, Trash2, Github } from 'lucide-react';
import { format } from 'date-fns';

interface Integration { id: string; type: string; name: string; isActive: boolean; installedAt: string; _count: { webhookEvents: number }; }

const typeIcon: Record<string, React.ReactNode> = {
  GITHUB: <Github className="w-5 h-5" />,
  GITLAB: <GitBranch className="w-5 h-5" />,
  SLACK: <GitBranch className="w-5 h-5" />,
  WEBHOOK: <GitBranch className="w-5 h-5" />,
};

export function IntegrationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'GITHUB', name: '', config: '{}' });
  const [error, setError] = useState('');

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (body: object) => api.post('/integrations', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations'] }); setOpen(false); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Connect GitHub, GitLab, and other services"
        action={<button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Integration</button>}
      />

      {isLoading ? <div className="text-gray-500 text-sm">Loading…</div> :
        integrations.length === 0 ? <EmptyState icon={GitBranch} title="No integrations" description="Connect GitHub or GitLab to enable CI/CD checks and webhook events." /> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((i) => (
            <div key={i.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400">
                  {typeIcon[i.type]}
                </div>
                <button onClick={() => { if (confirm('Delete integration?')) remove.mutate(i.id); }} className="text-gray-600 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-semibold text-white mb-1">{i.name}</h3>
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge status={i.type} />
                {i.isActive ? <span className="badge badge-green">Active</span> : <span className="badge badge-gray">Inactive</span>}
              </div>
              <p className="text-xs text-gray-500">{i._count.webhookEvents} events · Added {format(new Date(i.installedAt), 'MMM d, yyyy')}</p>
            </div>
          ))}
        </div>
      }

      <Modal open={open} onClose={() => setOpen(false)} title="Add Integration">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); try { create.mutate({ ...form, config: JSON.parse(form.config) }); } catch { setError('Invalid JSON in config'); } }} className="space-y-4">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="GITHUB">GitHub</option>
              <option value="GITLAB">GitLab</option>
              <option value="SLACK">Slack</option>
              <option value="WEBHOOK">Webhook</option>
            </select>
          </div>
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div>
            <label className="label">Config (JSON)</label>
            <textarea className="input font-mono text-xs" rows={4} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} placeholder='{"webhookSecret": "...", "repoUrl": "..."}' />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">{create.isPending ? 'Adding…' : 'Add Integration'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
