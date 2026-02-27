import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { Globe, Plus, Lock } from 'lucide-react';

interface Env { id: string; name: string; slug: string; type: string; description: string; requiresApproval: boolean; _count: { configs: number }; }

export function EnvironmentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', type: 'DEVELOPMENT', description: '', requiresApproval: false });
  const [error, setError] = useState('');

  const { data: envs = [], isLoading } = useQuery<Env[]>({
    queryKey: ['environments'],
    queryFn: () => api.get('/environments').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (body: object) => api.post('/environments', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['environments'] }); setOpen(false); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const typeColors: Record<string, string> = {
    DEVELOPMENT: 'bg-blue-900/40 text-blue-400',
    STAGING: 'bg-yellow-900/40 text-yellow-400',
    PRODUCTION: 'bg-green-900/40 text-green-400',
    CUSTOM: 'bg-purple-900/40 text-purple-400',
  };

  return (
    <div>
      <PageHeader
        title="Environments"
        description="Manage deployment environments for your agents"
        action={<button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Environment</button>}
      />

      {isLoading ? <div className="text-gray-500 text-sm">Loading…</div> :
        envs.length === 0 ? <EmptyState icon={Globe} title="No environments" description="Environments are created automatically when you register." /> :
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {envs.map((env) => (
            <div key={env.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeColors[env.type] ?? 'bg-gray-800 text-gray-400'}`}>
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  {env.requiresApproval && <Lock className="w-3.5 h-3.5 text-yellow-400" title="Requires approval" />}
                  <StatusBadge status={env.type} />
                </div>
              </div>
              <h3 className="font-semibold text-white mb-1">{env.name}</h3>
              <p className="text-xs text-gray-500 font-mono mb-2">{env.slug}</p>
              {env.description && <p className="text-sm text-gray-400 mb-3">{env.description}</p>}
              <p className="text-xs text-gray-600">{env._count.configs} config{env._count.configs !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      }

      <Modal open={open} onClose={() => setOpen(false)} title="New Environment">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })} required /></div>
          <div><label className="label">Slug</label><input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="DEVELOPMENT">Development</option>
              <option value="STAGING">Staging</option>
              <option value="PRODUCTION">Production</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="approval" checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} className="rounded" />
            <label htmlFor="approval" className="text-sm text-gray-300">Requires approval for promotions</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">{create.isPending ? 'Creating…' : 'Create'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
