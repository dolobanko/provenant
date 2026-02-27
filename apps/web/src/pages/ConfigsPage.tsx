import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { Settings, Plus, Key, Trash2 } from 'lucide-react';

interface Config {
  id: string; config: Record<string, unknown>; isActive: boolean;
  agent: { name: string }; environment: { name: string; type: string };
  secrets: { id: string; key: string }[];
}

export function ConfigsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [secretOpen, setSecretOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ agentId: '', environmentId: '', config: '{}', overrides: '{}' });
  const [secretForm, setSecretForm] = useState({ key: '', value: '' });
  const [error, setError] = useState('');

  const { data: configs = [], isLoading } = useQuery<Config[]>({
    queryKey: ['configs'],
    queryFn: () => api.get('/configs').then((r) => r.data),
  });
  const { data: agents = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ['agents'], queryFn: () => api.get('/agents').then((r) => r.data) });
  const { data: envs = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ['environments'], queryFn: () => api.get('/environments').then((r) => r.data) });

  const create = useMutation({
    mutationFn: (body: object) => api.post('/configs', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['configs'] }); setOpen(false); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const addSecret = useMutation({
    mutationFn: ({ id, ...body }: { id: string; key: string; value: string }) => api.post(`/configs/${id}/secrets`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['configs'] }); setSecretOpen(null); setSecretForm({ key: '', value: '' }); },
  });

  const deleteSecret = useMutation({
    mutationFn: ({ id, key }: { id: string; key: string }) => api.delete(`/configs/${id}/secrets/${key}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['configs'] }),
  });

  return (
    <div>
      <PageHeader
        title="Configurations"
        description="Manage agent configs per environment"
        action={<button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Config</button>}
      />

      {isLoading ? <div className="text-gray-500 text-sm">Loading…</div> :
        configs.length === 0 ? <EmptyState icon={Settings} title="No configurations" description="Create a config to set environment-specific agent settings." /> :
        <div className="space-y-4">
          {configs.map((c) => (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">{c.agent?.name}</h3>
                  <p className="text-sm text-gray-400">{c.environment?.name} ({c.environment?.type})</p>
                </div>
                <button onClick={() => setSecretOpen(c.id)} className="btn-secondary flex items-center gap-1 text-xs"><Key className="w-3 h-3" /> Add Secret</button>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Config</p>
                <pre className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-auto max-h-32">{JSON.stringify(c.config, null, 2)}</pre>
              </div>

              {c.secrets.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Secrets ({c.secrets.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {c.secrets.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
                        <Key className="w-3 h-3 text-yellow-400" />
                        <span className="text-xs font-mono text-gray-300">{s.key}</span>
                        <button onClick={() => deleteSecret.mutate({ id: c.id, key: s.key })} className="text-gray-600 hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      }

      <Modal open={open} onClose={() => setOpen(false)} title="New Configuration">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); try { create.mutate({ ...form, config: JSON.parse(form.config), overrides: JSON.parse(form.overrides) }); } catch { setError('Invalid JSON'); } }} className="space-y-4">
          <div><label className="label">Agent</label><select className="input" value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} required><option value="">Select…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <div><label className="label">Environment</label><select className="input" value={form.environmentId} onChange={(e) => setForm({ ...form, environmentId: e.target.value })} required><option value="">Select…</option>{envs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
          <div><label className="label">Config (JSON)</label><textarea className="input font-mono text-xs" rows={4} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} /></div>
          <div><label className="label">Overrides (JSON)</label><textarea className="input font-mono text-xs" rows={2} value={form.overrides} onChange={(e) => setForm({ ...form, overrides: e.target.value })} /></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">{create.isPending ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!secretOpen} onClose={() => setSecretOpen(null)} title="Add Secret" size="sm">
        <form onSubmit={(e) => { e.preventDefault(); addSecret.mutate({ id: secretOpen!, ...secretForm }); }} className="space-y-4">
          <div><label className="label">Key</label><input className="input" value={secretForm.key} onChange={(e) => setSecretForm({ ...secretForm, key: e.target.value })} required /></div>
          <div><label className="label">Value</label><input type="password" className="input" value={secretForm.value} onChange={(e) => setSecretForm({ ...secretForm, value: e.target.value })} required /></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={addSecret.isPending} className="btn-primary flex-1">Save Secret</button>
            <button type="button" onClick={() => setSecretOpen(null)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
