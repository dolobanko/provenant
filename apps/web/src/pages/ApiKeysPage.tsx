import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { Key, Plus, Copy, Trash2, Check } from 'lucide-react';
import { format } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  user: { name: string; email: string };
}

export function ApiKeysPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [form, setForm] = useState({ name: '', expiresAt: '' });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/org/keys').then((r) => r.data),
  });

  const createKey = useMutation({
    mutationFn: (body: object) => api.post('/org/keys', body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKeyValue(res.data.key);
      setOpen(false);
      setForm({ name: '', expiresAt: '' });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const deleteKey = useMutation({
    mutationFn: (id: string) => api.delete(`/org/keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  function copyKey() {
    navigator.clipboard.writeText(newKeyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <PageHeader
        title="API Keys"
        description="Authenticate SDK and programmatic access with permanent API keys"
        action={
          <button
            onClick={() => { setOpen(true); setError(''); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Key
          </button>
        }
      />

      {/* One-time key display banner */}
      {newKeyValue && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-800 rounded-xl">
          <p className="text-sm font-medium text-green-300 mb-2">
            Your new API key — copy it now, it will not be shown again:
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-xs font-mono text-green-200 bg-gray-900 px-3 py-2 rounded-lg overflow-x-auto">
              {newKeyValue}
            </code>
            <button onClick={copyKey} className="btn-secondary flex items-center gap-1 shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon={Key}
          title="No API keys"
          description="Create an API key to authenticate the SDK or CI/CD pipelines."
          action={<button onClick={() => setOpen(true)} className="btn-primary">Create API Key</button>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Prefix</th>
                <th className="table-header">Created by</th>
                <th className="table-header">Last used</th>
                <th className="table-header">Expires</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="table-row">
                  <td className="table-cell font-medium text-white">{k.name}</td>
                  <td className="table-cell font-mono text-xs text-gray-400">
                    pk_live_{k.keyPrefix}••••••••
                  </td>
                  <td className="table-cell text-xs text-gray-400">{k.user.name}</td>
                  <td className="table-cell text-xs">
                    {k.lastUsedAt ? format(new Date(k.lastUsedAt), 'MMM d, HH:mm') : 'Never'}
                  </td>
                  <td className="table-cell text-xs">
                    {k.expiresAt ? format(new Date(k.expiresAt), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => { if (confirm('Revoke this API key?')) deleteKey.mutate(k.id); }}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create API Key">
        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createKey.mutate({ name: form.name, expiresAt: form.expiresAt || undefined });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g. CI/CD Pipeline, Local Dev"
            />
          </div>
          <div>
            <label className="label">Expires at (optional)</label>
            <input
              type="date"
              className="input"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createKey.isPending} className="btn-primary flex-1">
              {createKey.isPending ? 'Creating…' : 'Create Key'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
