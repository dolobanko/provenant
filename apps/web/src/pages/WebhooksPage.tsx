import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Webhook, Plus, Trash2, Play, ChevronDown, ChevronRight, Copy, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';

interface WebhookRecord {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  deliveries: Array<{ statusCode: number | null; createdAt: string; durationMs: number | null }>;
}

interface Delivery {
  id: string;
  event: string;
  statusCode: number | null;
  durationMs: number | null;
  response: string | null;
  createdAt: string;
}

const ALL_EVENTS = [
  { id: 'drift.detected', label: 'Drift Detected', desc: 'When HIGH or CRITICAL drift is reported' },
  { id: 'eval.failed', label: 'Eval Failed', desc: 'When a run completes with pass rate < 80%' },
  { id: 'policy.violated', label: 'Policy Violated', desc: 'When any policy violation is created' },
  { id: 'session.ended', label: 'Session Ended', desc: 'When an agent session is ended' },
];

function StatusDot({ code }: { code: number | null }) {
  if (code === null) return <span className="badge badge-gray">No delivery</span>;
  if (code >= 200 && code < 300) return <span className="badge badge-green">{code}</span>;
  return <span className="badge badge-red">{code}</span>;
}

function isSlackUrl(url: string) {
  return url.includes('hooks.slack.com');
}

export function WebhooksPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newSecretInfo, setNewSecretInfo] = useState<{ id: string; secret: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { statusCode: number | null; success: boolean; error?: string }>>({});

  // Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['drift.detected', 'eval.failed']);
  const [formError, setFormError] = useState('');

  const { data: webhooks = [], isLoading } = useQuery<WebhookRecord[]>({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/webhooks').then((r) => r.data),
  });

  const { data: deliveries = [], refetch: refetchDeliveries } = useQuery<Delivery[]>({
    queryKey: ['webhook-deliveries', expanded],
    queryFn: () => api.get(`/webhooks/${expanded}/deliveries`).then((r) => r.data),
    enabled: !!expanded,
  });

  const createWebhook = useMutation({
    mutationFn: (body: object) => api.post('/webhooks', body).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      setNewSecretInfo({ id: data.id, secret: data.secret });
      setCreateOpen(false);
      setName(''); setUrl(''); setSelectedEvents(['drift.detected', 'eval.failed']);
      setFormError('');
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  const deleteWebhook = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/webhooks/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const testWebhook = useMutation({
    mutationFn: (id: string) => api.post(`/webhooks/${id}/test`).then((r) => r.data),
    onSuccess: (data, id) => {
      setTestResults((prev) => ({ ...prev, [id]: data }));
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      if (expanded === id) refetchDeliveries();
    },
  });

  function toggleEvent(ev: string) {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  }

  function copySecret(secret: string) {
    navigator.clipboard.writeText(secret).then(() => {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    });
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <PageHeader
        title="Webhooks"
        description="Get notified when drift is detected, evals fail, or policies are violated."
        action={
          <button className="btn-primary flex items-center gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" /> New Webhook
          </button>
        }
      />

      {/* New secret banner */}
      {newSecretInfo && (
        <div className="mb-6 p-4 bg-green-900/30 border border-green-800 rounded-xl">
          <p className="text-sm font-medium text-green-300 mb-2">
            ✅ Webhook created! Copy your signing secret now — it won't be shown again.
          </p>
          <div className="flex items-center gap-2 bg-gray-950 rounded-lg px-3 py-2 border border-gray-800">
            <code className="text-xs text-green-400 flex-1 font-mono break-all">{newSecretInfo.secret}</code>
            <button
              onClick={() => copySecret(newSecretInfo.secret)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 flex-shrink-0"
            >
              {copiedSecret ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSecret ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setNewSecretInfo(null)}
            className="text-xs text-gray-500 hover:text-gray-400 mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Webhooks list */}
      {isLoading ? (
        <div className="text-center py-20 text-gray-500">Loading…</div>
      ) : webhooks.length === 0 ? (
        <div className="card text-center py-16">
          <Webhook className="w-10 h-10 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 font-medium mb-1">No webhooks yet</p>
          <p className="text-sm text-gray-600 mb-6">
            Create a webhook to receive real-time notifications for drift, eval failures, and policy violations.
          </p>
          <button className="btn-primary mx-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 inline mr-2" />New Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const lastDelivery = wh.deliveries[0];
            const testResult = testResults[wh.id];
            const isExpanded = expanded === wh.id;

            return (
              <div key={wh.id} className="card !p-0 overflow-hidden">
                {/* Row */}
                <div className="px-5 py-4 flex items-center gap-4">
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : wh.id)}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{wh.name}</span>
                      {isSlackUrl(wh.url) && (
                        <span className="badge badge-purple text-xs">Slack</span>
                      )}
                      {!wh.isActive && <span className="badge badge-gray text-xs">Inactive</span>}
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{wh.url}</div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {(wh.events as string[]).map((ev) => (
                        <span key={ev} className="badge badge-blue text-xs">{ev}</span>
                      ))}
                    </div>
                  </div>

                  {/* Last delivery */}
                  <div className="hidden sm:block text-right text-xs text-gray-500 min-w-[80px]">
                    {lastDelivery ? (
                      <>
                        <StatusDot code={lastDelivery.statusCode} />
                        <div className="mt-1">{lastDelivery.durationMs}ms</div>
                      </>
                    ) : (
                      <span className="text-gray-600">No deliveries</span>
                    )}
                  </div>

                  {/* Test result */}
                  {testResult && (
                    <div className="hidden sm:block text-xs">
                      <StatusDot code={testResult.statusCode} />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      title={wh.isActive ? 'Disable' : 'Enable'}
                      onClick={() => toggleActive.mutate({ id: wh.id, isActive: !wh.isActive })}
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {wh.isActive
                        ? <ToggleRight className="w-5 h-5 text-brand-400" />
                        : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      title="Send test event"
                      onClick={() => testWebhook.mutate(wh.id)}
                      disabled={testWebhook.isPending}
                      className="text-gray-500 hover:text-brand-400 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteWebhook.mutate(wh.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delivery history */}
                {isExpanded && (
                  <div className="border-t border-gray-800 bg-gray-900/50">
                    <div className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recent Deliveries
                    </div>
                    {deliveries.length === 0 ? (
                      <div className="px-5 pb-4 text-sm text-gray-600">No deliveries yet. Click ▶ to send a test.</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-800">
                            <th className="table-header">Event</th>
                            <th className="table-header">Status</th>
                            <th className="table-header">Duration</th>
                            <th className="table-header">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliveries.map((d) => (
                            <tr key={d.id} className="table-row">
                              <td className="table-cell font-mono">{d.event}</td>
                              <td className="table-cell"><StatusDot code={d.statusCode} /></td>
                              <td className="table-cell">{d.durationMs != null ? `${d.durationMs}ms` : '—'}</td>
                              <td className="table-cell text-gray-500">
                                {new Date(d.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setFormError(''); }} title="New Webhook">
        {formError && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">
            {formError}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedEvents.length === 0) { setFormError('Select at least one event.'); return; }
            createWebhook.mutate({ name, url, events: selectedEvents });
          }}
          className="space-y-5"
        >
          <div>
            <label className="label">Name</label>
            <input
              className="input w-full"
              placeholder="e.g. Production alerts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Endpoint URL</label>
            <input
              className="input w-full"
              type="url"
              placeholder="https://your-server.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            {isSlackUrl(url) && (
              <p className="mt-2 text-xs text-blue-400 bg-blue-900/20 border border-blue-800/40 rounded-lg px-3 py-2">
                💬 Slack webhook detected — payload will be formatted as Slack blocks automatically.
              </p>
            )}
          </div>

          <div>
            <label className="label">Events</label>
            <div className="space-y-2">
              {ALL_EVENTS.map((ev) => (
                <label key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-750 cursor-pointer border border-transparent hover:border-gray-700 transition-colors">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedEvents.includes(ev.id)}
                    onChange={() => toggleEvent(ev.id)}
                  />
                  <div>
                    <div className="text-sm font-medium text-white">{ev.label}</div>
                    <div className="text-xs text-gray-500">{ev.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createWebhook.isPending} className="btn-primary flex-1">
              {createWebhook.isPending ? 'Creating…' : 'Create Webhook'}
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
