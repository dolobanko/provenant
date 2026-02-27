import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { FlaskConical, Plus, Play, Download, Wand2, Check } from 'lucide-react';
import { format } from 'date-fns';

interface Suite { id: string; name: string; description: string; _count: { cases: number; runs: number }; }
interface Run { id: string; status: string; score: number; passRate: number; createdAt: string; agent: { name: string }; suite: { name: string }; }
interface Template { id: string; name: string; description: string; category: string; caseCount: number; }
interface GeneratedCase {
  name: string;
  description: string;
  input: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
  scoringFn: string;
  tags: string[];
}

export function EvalsPage() {
  const qc = useQueryClient();
  const [suiteOpen, setSuiteOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState<string | null>(null); // suiteId being imported into
  const [suiteForm, setSuiteForm] = useState({ name: '', description: '', tags: '' });
  const [runForm, setRunForm] = useState({ suiteId: '', agentId: '', agentVersionId: '', environmentId: '' });
  const [error, setError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // AI generate state
  const [genSuiteId, setGenSuiteId] = useState<string | null>(null);
  const [genCount, setGenCount] = useState(5);
  const [genCases, setGenCases] = useState<GeneratedCase[]>([]);
  const [genSelected, setGenSelected] = useState<Set<number>>(new Set());
  const [genStep, setGenStep] = useState<'config' | 'review'>('config');
  const [genError, setGenError] = useState('');

  const { data: suites = [] } = useQuery<Suite[]>({ queryKey: ['eval-suites'], queryFn: () => api.get('/evals/suites').then((r) => r.data) });
  const { data: runs = [], isLoading } = useQuery<Run[]>({ queryKey: ['eval-runs'], queryFn: () => api.get('/evals/runs').then((r) => r.data) });
  const { data: agents = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ['agents'], queryFn: () => api.get('/agents').then((r) => r.data) });
  const { data: envs = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ['environments'], queryFn: () => api.get('/environments').then((r) => r.data) });
  const { data: templates = [] } = useQuery<Template[]>({ queryKey: ['eval-templates'], queryFn: () => api.get('/evals/templates').then((r) => r.data) });

  const createSuite = useMutation({
    mutationFn: (body: object) => api.post('/evals/suites', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eval-suites'] }); setSuiteOpen(false); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const createRun = useMutation({
    mutationFn: (body: object) => api.post('/evals/runs', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eval-runs'] }); setRunOpen(false); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const generateCases = useMutation({
    mutationFn: ({ suiteId, count }: { suiteId: string; count: number }) =>
      api.post(`/evals/suites/${suiteId}/generate-cases`, { count }).then((r) => r.data),
    onSuccess: (data: { cases: GeneratedCase[] }) => {
      setGenCases(data.cases);
      setGenSelected(new Set(data.cases.map((_, i) => i)));
      setGenStep('review');
      setGenError('');
    },
    onError: (err) => setGenError(getErrorMessage(err)),
  });

  const importGenerated = useMutation({
    mutationFn: async ({ suiteId, cases }: { suiteId: string; cases: GeneratedCase[] }) => {
      for (const c of cases) {
        await api.post(`/evals/suites/${suiteId}/cases`, c);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-suites'] });
      setGenSuiteId(null);
      setGenStep('config');
      setGenCases([]);
      setGenSelected(new Set());
      setImportSuccess(`Imported ${genSelected.size} AI-generated case${genSelected.size !== 1 ? 's' : ''} successfully.`);
      setTimeout(() => setImportSuccess(''), 3000);
    },
    onError: (err) => setGenError(getErrorMessage(err)),
  });

  function openGenerate(suiteId: string) {
    setGenSuiteId(suiteId);
    setGenStep('config');
    setGenCases([]);
    setGenSelected(new Set());
    setGenError('');
    setGenCount(5);
  }

  function closeGenerate() {
    setGenSuiteId(null);
    setGenStep('config');
    setGenCases([]);
    setGenSelected(new Set());
    setGenError('');
  }

  function toggleGenCase(i: number) {
    setGenSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  const importTemplate = useMutation({
    mutationFn: ({ suiteId, templateId }: { suiteId: string; templateId: string }) =>
      api.post(`/evals/suites/${suiteId}/import-template/${templateId}`, {}).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['eval-suites'] });
      setTemplateOpen(null);
      setImportSuccess(`Imported ${data.imported} cases successfully.`);
      setTimeout(() => setImportSuccess(''), 3000);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Evaluations"
        description="Test and benchmark your agent versions"
        action={
          <div className="flex gap-2">
            <button onClick={() => setSuiteOpen(true)} className="btn-secondary flex items-center gap-2"><Plus className="w-4 h-4" /> New Suite</button>
            <button onClick={() => setRunOpen(true)} className="btn-primary flex items-center gap-2"><Play className="w-4 h-4" /> Run Eval</button>
          </div>
        }
      />

      {importSuccess && (
        <div className="mb-4 p-3 bg-green-900/40 border border-green-800 rounded-lg text-sm text-green-300">{importSuccess}</div>
      )}

      {/* Suites */}
      {suites.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Suites</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suites.map((s) => (
              <div key={s.id} className="card">
                <div className="w-8 h-8 rounded-lg bg-purple-900/40 flex items-center justify-center mb-3">
                  <FlaskConical className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="font-semibold text-white mb-1">{s.name}</h3>
                {s.description && <p className="text-sm text-gray-400 mb-3">{s.description}</p>}
                <p className="text-xs text-gray-500 mb-3">{s._count.cases} cases · {s._count.runs} runs</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setTemplateOpen(s.id); setError(''); }}
                    className="btn-secondary flex items-center gap-1.5 text-xs flex-1 justify-center"
                  >
                    <Download className="w-3 h-3" /> Import Template
                  </button>
                  <button
                    onClick={() => openGenerate(s.id)}
                    className="btn-secondary flex items-center gap-1.5 text-xs flex-1 justify-center text-purple-400 hover:text-purple-300"
                  >
                    <Wand2 className="w-3 h-3" /> Generate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Runs */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Runs</h2>
      {isLoading ? <div className="text-gray-500 text-sm">Loading…</div> :
        runs.length === 0 ? <EmptyState icon={FlaskConical} title="No eval runs" description="Create a suite and run an evaluation to get started." /> :
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="table-header">Agent</th><th className="table-header">Suite</th><th className="table-header">Status</th><th className="table-header">Score</th><th className="table-header">Pass Rate</th><th className="table-header">Date</th><th className="table-header"></th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-medium text-white">{r.agent?.name}</td>
                  <td className="table-cell text-gray-400">{r.suite?.name}</td>
                  <td className="table-cell"><StatusBadge status={r.status} /></td>
                  <td className="table-cell">{r.score != null ? r.score.toFixed(1) : '—'}</td>
                  <td className="table-cell">{r.passRate != null ? `${(r.passRate * 100).toFixed(0)}%` : '—'}</td>
                  <td className="table-cell text-xs">{format(new Date(r.createdAt), 'MMM d, HH:mm')}</td>
                  <td className="table-cell"><Link to={`/evals/runs/${r.id}`} className="text-brand-400 hover:text-brand-300 text-xs">View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }

      <Modal open={suiteOpen} onClose={() => setSuiteOpen(false)} title="New Eval Suite">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); createSuite.mutate({ ...suiteForm, tags: suiteForm.tags ? suiteForm.tags.split(',').map((t) => t.trim()) : [] }); }} className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={suiteForm.name} onChange={(e) => setSuiteForm({ ...suiteForm, name: e.target.value })} required /></div>
          <div><label className="label">Description</label><textarea className="input" rows={2} value={suiteForm.description} onChange={(e) => setSuiteForm({ ...suiteForm, description: e.target.value })} /></div>
          <div><label className="label">Tags</label><input className="input" value={suiteForm.tags} onChange={(e) => setSuiteForm({ ...suiteForm, tags: e.target.value })} /></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createSuite.isPending} className="btn-primary flex-1">{createSuite.isPending ? 'Creating…' : 'Create Suite'}</button>
            <button type="button" onClick={() => setSuiteOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!templateOpen} onClose={() => setTemplateOpen(null)} title="Import Template">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <p className="text-sm text-gray-400 mb-4">Select a built-in template to import test cases into your suite.</p>
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
              <div>
                <p className="text-sm font-medium text-white">{t.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
                <p className="text-xs text-gray-500 mt-1">{t.caseCount} cases · {t.category}</p>
              </div>
              <button
                onClick={() => { if (templateOpen) importTemplate.mutate({ suiteId: templateOpen, templateId: t.id }); }}
                disabled={importTemplate.isPending}
                className="btn-primary text-xs ml-4 flex-shrink-0"
              >
                {importTemplate.isPending ? 'Importing…' : 'Import'}
              </button>
            </div>
          ))}
          {templates.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No templates available.</p>}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={() => setTemplateOpen(null)} className="btn-secondary">Close</button>
        </div>
      </Modal>

      {/* AI Generate Modal */}
      <Modal open={!!genSuiteId} onClose={closeGenerate} title={genStep === 'config' ? 'Generate Eval Cases with AI' : `Review Generated Cases (${genCases.length})`} size="lg">
        {genError && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{genError}</div>
        )}

        {genStep === 'config' ? (
          <div className="space-y-5">
            <div className="p-3 bg-purple-900/20 border border-purple-800/40 rounded-lg">
              <p className="text-sm text-purple-300">
                ✨ Cases are generated from your most recent completed sessions using <strong>claude-haiku-4-5</strong>. Review and select which ones to import.
              </p>
            </div>
            <div>
              <label className="label">How many cases to generate?</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1} max={10}
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="flex-1 accent-brand-600"
                />
                <span className="text-white font-semibold w-6 text-center">{genCount}</span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { if (genSuiteId) generateCases.mutate({ suiteId: genSuiteId, count: genCount }); }}
                disabled={generateCases.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {generateCases.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Generate &rarr;</>
                )}
              </button>
              <button onClick={closeGenerate} className="btn-secondary">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Select the cases you want to import. All are selected by default.
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {genCases.map((c, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    genSelected.has(i)
                      ? 'bg-brand-900/20 border-brand-700/50'
                      : 'bg-gray-800/50 border-gray-700 opacity-50'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <div
                      onClick={() => toggleGenCase(i)}
                      className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                        genSelected.has(i) ? 'bg-brand-600 border-brand-600' : 'border-gray-600 bg-gray-800'
                      }`}
                    >
                      {genSelected.has(i) && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => toggleGenCase(i)}>
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="badge badge-gray text-xs">{c.scoringFn}</span>
                      {c.tags?.slice(0, 3).map((tag) => (
                        <span key={tag} className="badge badge-blue text-xs">{tag}</span>
                      ))}
                    </div>
                    <div className="mt-2 bg-gray-950 rounded px-2 py-1.5 font-mono text-xs text-green-400 truncate">
                      {JSON.stringify(c.input).slice(0, 100)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-800">
              <button
                onClick={() => setGenStep('config')}
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                ← Regenerate
              </button>
              <div className="flex-1" />
              <button onClick={closeGenerate} className="btn-secondary">Cancel</button>
              <button
                disabled={genSelected.size === 0 || importGenerated.isPending}
                onClick={() => {
                  if (!genSuiteId) return;
                  const selected = genCases.filter((_, i) => genSelected.has(i));
                  importGenerated.mutate({ suiteId: genSuiteId, cases: selected });
                }}
                className="btn-primary"
              >
                {importGenerated.isPending ? 'Importing…' : `Import selected (${genSelected.size})`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={runOpen} onClose={() => setRunOpen(false)} title="Run Evaluation">
        {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); createRun.mutate({ ...runForm, agentVersionId: runForm.agentVersionId || undefined, environmentId: runForm.environmentId || undefined }); }} className="space-y-4">
          <div><label className="label">Suite</label><select className="input" value={runForm.suiteId} onChange={(e) => setRunForm({ ...runForm, suiteId: e.target.value })} required><option value="">Select…</option>{suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className="label">Agent</label><select className="input" value={runForm.agentId} onChange={(e) => setRunForm({ ...runForm, agentId: e.target.value })} required><option value="">Select…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <div><label className="label">Environment (optional)</label><select className="input" value={runForm.environmentId} onChange={(e) => setRunForm({ ...runForm, environmentId: e.target.value })}><option value="">None</option>{envs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createRun.isPending} className="btn-primary flex-1">{createRun.isPending ? 'Starting…' : 'Start Run'}</button>
            <button type="button" onClick={() => setRunOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
