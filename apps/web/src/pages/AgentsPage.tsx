import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { CardGridSkeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { Bot, Plus } from 'lucide-react';

interface Agent { id: string; name: string; slug: string; description: string; tags: string[]; status: string; modelFamily: string; _count: { versions: number }; updatedAt: string; }

export function AgentsPage() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '', modelFamily: '', tags: '' });
  const [error, setError] = useState('');

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (body: object) => api.post('/agents', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      setOpen(false);
      setForm({ name: '', slug: '', description: '', modelFamily: '', tags: '' });
      success('Agent created successfully');
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setError(msg);
      toastError(msg);
    },
  });

  function handleName(name: string) {
    setForm({ ...form, name, slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    create.mutate({ ...form, tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [] });
  }

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Manage your AI agents and their versions"
        action={<button onClick={() => { setOpen(true); setError(''); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Agent</button>}
      />

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Create your first agent to start tracking AI behaviour, running evals, and capturing sessions."
          action={<button onClick={() => setOpen(true)} className="btn-primary">Create your first agent</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Link key={agent.id} to={`/agents/${agent.id}`} className="card hover:border-gray-700 transition-colors block">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-brand-400" />
                </div>
                <StatusBadge status={agent.status} />
              </div>
              <h3 className="font-semibold text-white mb-1">{agent.name}</h3>
              <p className="text-xs text-gray-500 font-mono mb-2">{agent.slug}</p>
              {agent.description && <p className="text-sm text-gray-400 mb-3 line-clamp-2">{agent.description}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                {agent.modelFamily && <span className="badge badge-purple">{agent.modelFamily}</span>}
                {agent.tags?.slice(0, 3).map((t) => <span key={t} className="badge badge-gray">{t}</span>)}
              </div>
              <p className="text-xs text-gray-600 mt-3">{agent._count.versions} version{agent._count.versions !== 1 ? 's' : ''}</p>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Agent">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => handleName(e.target.value)} required /></div>
          <div><label className="label">Slug</label><input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required pattern="[a-z0-9-]+" /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">Model family</label><input className="input" placeholder="e.g. claude-3, gpt-4" value={form.modelFamily} onChange={(e) => setForm({ ...form, modelFamily: e.target.value })} /></div>
          <div><label className="label">Tags (comma-separated)</label><input className="input" placeholder="support, billing" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">{create.isPending ? 'Creating…' : 'Create Agent'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
