import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { GitBranch, Plus, Trash2, Github, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';

interface Integration { id: string; type: string; name: string; isActive: boolean; installedAt: string; _count: { webhookEvents: number }; }

const typeIcon: Record<string, React.ReactNode> = {
  GITHUB: <Github className="w-5 h-5" />,
  GITLAB: <GitBranch className="w-5 h-5" />,
  SLACK: <GitBranch className="w-5 h-5" />,
  WEBHOOK: <GitBranch className="w-5 h-5" />,
};

const CONFIG_TEMPLATES: Record<string, object> = {
  GITHUB: {
    token: 'ghp_your_personal_access_token',
    webhookSecret: 'a-random-secret-string',
  },
  GITLAB: {
    token: 'glpat-your_gitlab_token',
    webhookSecret: 'a-random-secret-string',
  },
  SLACK: {
    webhookUrl: 'https://hooks.slack.com/services/T.../B.../...',
  },
  WEBHOOK: {
    webhookSecret: 'a-random-secret-string',
  },
};

const CONFIG_GUIDES: Record<string, { fields: { key: string; description: string }[]; steps?: string[] }> = {
  GITHUB: {
    fields: [
      { key: 'token', description: 'GitHub Personal Access Token — go to github.com/settings/tokens → New token (classic) → check repo + admin:repo_hook scopes' },
      { key: 'webhookSecret', description: 'Any random string — you\'ll paste this into the GitHub webhook settings as the "Secret"' },
    ],
    steps: [
      'After saving, copy the Webhook URL from the integration card',
      'Go to your GitHub repo → Settings → Webhooks → Add webhook',
      'Paste the Webhook URL and your webhookSecret, set content type to application/json',
    ],
  },
  GITLAB: {
    fields: [
      { key: 'token', description: 'GitLab Personal Access Token — go to gitlab.com/-/user_settings/personal_access_tokens → check api scope' },
      { key: 'webhookSecret', description: 'Any random string — paste into GitLab webhook Secret Token field' },
    ],
    steps: [
      'After saving, copy the Webhook URL from the integration card',
      'Go to your GitLab project → Settings → Webhooks → Add new webhook',
      'Paste the Webhook URL and your webhookSecret',
    ],
  },
  SLACK: {
    fields: [
      { key: 'webhookUrl', description: 'Slack Incoming Webhook URL — go to api.slack.com/apps → Create app → Incoming Webhooks → Add New Webhook to Workspace' },
    ],
  },
  WEBHOOK: {
    fields: [
      { key: 'webhookSecret', description: 'Any random string used to verify incoming requests' },
    ],
    steps: [
      'After saving, copy the Webhook URL from the integration card',
      'Point any HTTP service at that URL to start receiving events',
    ],
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="ml-1 p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export function IntegrationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'GITHUB', name: '', config: JSON.stringify(CONFIG_TEMPLATES.GITHUB, null, 2) });
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

  function handleTypeChange(type: string) {
    setForm({ ...form, type, config: JSON.stringify(CONFIG_TEMPLATES[type] ?? {}, null, 2) });
  }

  const guide = CONFIG_GUIDES[form.type];

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Connect GitHub, GitLab, Slack, and other services"
        action={<button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Integration</button>}
      />

      {isLoading ? <div className="text-gray-500 text-sm">Loading…</div> :
        integrations.length === 0 ? <EmptyState icon={GitBranch} title="No integrations" description="Connect GitHub or GitLab to enable CI/CD checks and webhook events." /> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((i) => {
            const webhookUrl = `${API_BASE}/api/integrations/webhook/${i.id}`;
            return (
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
                <p className="text-xs text-gray-500 mb-3">{i._count.webhookEvents} events · Added {format(new Date(i.installedAt), 'MMM d, yyyy')}</p>
                {/* Webhook URL */}
                <div className="border-t border-gray-800 pt-3">
                  <p className="text-xs text-gray-500 mb-1">Webhook URL</p>
                  <div className="flex items-center gap-1 bg-gray-900 rounded px-2 py-1">
                    <span className="text-xs text-gray-400 font-mono truncate flex-1">{webhookUrl}</span>
                    <CopyButton text={webhookUrl} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      }

      <Modal open={open} onClose={() => setOpen(false)} title="Add Integration">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); try { create.mutate({ ...form, config: JSON.parse(form.config) }); } catch { setError('Invalid JSON in config'); } }} className="space-y-4">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
              <option value="GITHUB">GitHub</option>
              <option value="GITLAB">GitLab</option>
              <option value="SLACK">Slack</option>
              <option value="WEBHOOK">Webhook</option>
            </select>
          </div>
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`My ${form.type.charAt(0) + form.type.slice(1).toLowerCase()} integration`} required /></div>
          <div>
            <label className="label">Config (JSON)</label>
            <textarea className="input font-mono text-xs" rows={4} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} />
            {/* Per-field guide */}
            {guide && (
              <div className="mt-2 space-y-2">
                {guide.fields.map((f) => (
                  <div key={f.key} className="text-xs text-gray-500 flex gap-2">
                    <span className="text-brand-400 font-mono shrink-0">{f.key}:</span>
                    <span>{f.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step-by-step instructions */}
          {guide?.steps && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-400 mb-2">After saving:</p>
              <ol className="space-y-1">
                {guide.steps.map((step, idx) => (
                  <li key={idx} className="text-xs text-gray-500 flex gap-2">
                    <span className="text-brand-400 shrink-0">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">{create.isPending ? 'Adding…' : 'Add Integration'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
