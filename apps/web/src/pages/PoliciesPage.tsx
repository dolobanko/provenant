import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { Shield, Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Policy { id: string; name: string; description: string; type: string; isEnabled: boolean; enforcementLevel: string; _count: { violations: number }; }
interface Violation { id: string; resourceType: string; resourceId: string; severity: string; resolvedAt: string | null; createdAt: string; policy: { name: string }; }

export function PoliciesPage() {
  const qc = useQueryClient();
  const [policyOpen, setPolicyOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'DEPLOYMENT', rules: '[]', isEnabled: true, enforcementLevel: 'WARN' });
  const [error, setError] = useState('');

  const { data: policies = [] } = useQuery<Policy[]>({ queryKey: ['policies'], queryFn: () => api.get('/policies').then((r) => r.data) });
  const { data: violations = [], isLoading } = useQuery<Violation[]>({ queryKey: ['violations'], queryFn: () => api.get('/policies/violations').then((r) => r.data) });

  const createPolicy = useMutation({
    mutationFn: (body: object) => api.post('/policies', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['policies'] }); setPolicyOpen(false); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const resolveViolation = useMutation({
    mutationFn: (id: string) => api.post(`/policies/violations/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['violations'] }),
  });

  const openViolations = violations.filter((v) => !v.resolvedAt);

  return (
    <div>
      <PageHeader
        title="Policies"
        description="Governance rules and compliance enforcement"
        action={<button onClick={() => setPolicyOpen(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Policy</button>}
      />

      {/* Policies grid */}
      {policies.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Policies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {policies.map((p) => (
              <div key={p.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-900/40 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    {p.isEnabled ? <span className="badge badge-green">Enabled</span> : <span className="badge badge-gray">Disabled</span>}
                    <StatusBadge status={p.enforcementLevel} />
                  </div>
                </div>
                <h3 className="font-semibold text-white mb-1">{p.name}</h3>
                {p.description && <p className="text-sm text-gray-400 mb-2">{p.description}</p>}
                <div className="flex items-center gap-2">
                  <span className="badge badge-blue">{p.type}</span>
                  {p._count.violations > 0 && <span className="badge badge-red">{p._count.violations} violations</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Violations */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Open Violations <span className="text-red-400">({openViolations.length})</span>
      </h2>
      {isLoading ? <div className="text-gray-500 text-sm">Loading…</div> :
        openViolations.length === 0 ? <EmptyState icon={Shield} title="No open violations" description="All policy checks are passing." /> :
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="table-header">Policy</th><th className="table-header">Resource</th><th className="table-header">Severity</th><th className="table-header">Date</th><th className="table-header">Actions</th></tr></thead>
            <tbody>
              {openViolations.map((v) => (
                <tr key={v.id} className="table-row">
                  <td className="table-cell font-medium text-white">{v.policy?.name}</td>
                  <td className="table-cell text-xs text-gray-400">{v.resourceType} / {v.resourceId?.slice(0, 8)}…</td>
                  <td className="table-cell"><StatusBadge status={v.severity} /></td>
                  <td className="table-cell text-xs">{format(new Date(v.createdAt), 'MMM d, yyyy')}</td>
                  <td className="table-cell">
                    <button onClick={() => resolveViolation.mutate(v.id)} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }

      <Modal open={policyOpen} onClose={() => setPolicyOpen(false)} title="New Policy">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); try { createPolicy.mutate({ ...form, rules: JSON.parse(form.rules) }); } catch { setError('Invalid JSON in rules'); } }} className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">Type</label><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="DEPLOYMENT">Deployment</option><option value="CONTENT">Content</option><option value="RATE_LIMIT">Rate Limit</option><option value="DATA_PRIVACY">Data Privacy</option><option value="APPROVAL">Approval</option></select></div>
          <div><label className="label">Enforcement</label><select className="input" value={form.enforcementLevel} onChange={(e) => setForm({ ...form, enforcementLevel: e.target.value })}><option value="WARN">Warn</option><option value="BLOCK">Block</option><option value="NOTIFY">Notify</option></select></div>
          <div><label className="label">Rules (JSON array)</label><textarea className="input font-mono text-xs" rows={3} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} /></div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="enabled" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} />
            <label htmlFor="enabled" className="text-sm text-gray-300">Enabled</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createPolicy.isPending} className="btn-primary flex-1">{createPolicy.isPending ? 'Creating…' : 'Create Policy'}</button>
            <button type="button" onClick={() => setPolicyOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
