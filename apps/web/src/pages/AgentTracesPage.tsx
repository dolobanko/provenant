import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Cpu, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────────

interface FileAttribution {
  path: string;
  attributions: {
    model: string;
    lines?: [number, number][];
    conversationUrl?: string;
    aiLines?: number;
    humanLines?: number;
    mixedLines?: number;
  }[];
}

interface AgentTrace {
  id: string;
  traceId: string;
  specVersion: string;
  vcsType: string | null;
  vcsRevision: string | null;
  toolName: string | null;
  toolVersion: string | null;
  source: string;
  fileCount: number;
  createdAt: string;
  agentVersion: {
    semver: string;
    version: string;
    agentId: string;
  } | null;
}

interface AgentTraceDetail extends Omit<AgentTrace, 'fileCount'> {
  files: FileAttribution[];
  metadata: Record<string, unknown>;
}

// ── Expanded row ──────────────────────────────────────────────────────────────

function TraceDetail({ traceId }: { traceId: string }) {
  const { data, isLoading } = useQuery<AgentTraceDetail>({
    queryKey: ['agent-trace', traceId],
    queryFn: () => api.get(`/agent-traces/${traceId}`).then((r) => r.data),
  });

  if (isLoading) return <div className="p-4"><Skeleton className="h-32" /></div>;
  if (!data) return null;

  // Aggregate model stats across all files
  const modelStats: Record<string, { aiLines: number; files: number; urls: string[] }> = {};
  for (const file of data.files) {
    for (const attr of file.attributions) {
      if (!modelStats[attr.model]) modelStats[attr.model] = { aiLines: 0, files: 0, urls: [] };
      modelStats[attr.model].aiLines += attr.aiLines ?? 0;
      modelStats[attr.model].files++;
      if (attr.conversationUrl) modelStats[attr.model].urls.push(attr.conversationUrl);
    }
  }

  return (
    <div className="bg-gray-950 border-t border-gray-800 p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Model breakdown */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Model Breakdown</h4>
        {Object.keys(modelStats).length === 0 ? (
          <p className="text-xs text-gray-600">No attribution data.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(modelStats).map(([model, stats]) => (
              <div key={model} className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-gray-200 font-mono">{model}</p>
                  <p className="text-xs text-gray-500">{stats.files} file{stats.files !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{stats.aiLines.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">AI lines</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Conversation links */}
        {Object.values(modelStats).some((s) => s.urls.length > 0) && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Conversation Links</h4>
            <div className="space-y-1">
              {Object.values(modelStats).flatMap((s) => s.urls).slice(0, 5).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 truncate"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{url}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* File list */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Files ({data.files.length})
        </h4>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {data.files.length === 0 ? (
            <p className="text-xs text-gray-600">No file attributions recorded.</p>
          ) : (
            data.files.map((file) => {
              const totalAi = file.attributions.reduce((a, x) => a + (x.aiLines ?? 0), 0);
              const totalHuman = file.attributions.reduce((a, x) => a + (x.humanLines ?? 0), 0);
              const total = totalAi + totalHuman;
              const aiPct = total > 0 ? Math.round((totalAi / total) * 100) : 0;
              return (
                <div key={file.path} className="bg-gray-900 rounded px-3 py-2">
                  <p className="text-xs font-mono text-gray-300 truncate mb-1">{file.path}</p>
                  {total > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${aiPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">{aiPct}% AI</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AgentTracesPage() {
  const [searchParams] = useSearchParams();
  const agentVersionId = searchParams.get('agentVersionId') ?? undefined;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: traces = [], isLoading } = useQuery<AgentTrace[]>({
    queryKey: ['agent-traces', agentVersionId],
    queryFn: () =>
      api.get('/agent-traces', { params: agentVersionId ? { agentVersionId } : {} }).then((r) => r.data),
  });

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Code Provenance</h1>
          <p className="text-sm text-gray-400 mt-1">
            Agent Trace records — which AI models wrote which lines of code
          </p>
        </div>
        {agentVersionId && (
          <Link to="/agent-traces" className="btn-secondary text-xs py-1.5 px-3">
            Clear filter
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : traces.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No traces yet"
          description='Ingest traces via POST /api/agent-traces or via webhook with x-agent-trace: true header'
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header w-8" />
                <th className="table-header">Trace ID</th>
                <th className="table-header">Agent Version</th>
                <th className="table-header">Tool</th>
                <th className="table-header">Files</th>
                <th className="table-header">VCS Revision</th>
                <th className="table-header">Source</th>
                <th className="table-header">Date</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((t) => (
                <>
                  <tr
                    key={t.id}
                    className="table-row cursor-pointer"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  >
                    <td className="table-cell">
                      {expandedId === t.id
                        ? <ChevronDown className="w-4 h-4 text-gray-500" />
                        : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    </td>
                    <td className="table-cell font-mono text-xs text-gray-300">
                      {t.traceId.length > 16 ? `${t.traceId.slice(0, 16)}…` : t.traceId}
                    </td>
                    <td className="table-cell text-xs">
                      {t.agentVersion ? (
                        <Link
                          to={`/agents/${t.agentVersion.agentId}`}
                          className="text-brand-400 hover:text-brand-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          v{t.agentVersion.semver}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="table-cell text-xs text-gray-400">
                      {t.toolName ?? '—'}{t.toolVersion ? ` ${t.toolVersion}` : ''}
                    </td>
                    <td className="table-cell">{t.fileCount}</td>
                    <td className="table-cell font-mono text-xs text-gray-500">
                      {t.vcsRevision ? t.vcsRevision.slice(0, 8) : '—'}
                    </td>
                    <td className="table-cell">
                      <span className="badge badge-gray text-xs">{t.source}</span>
                    </td>
                    <td className="table-cell text-xs text-gray-500" title={format(new Date(t.createdAt), 'PPpp')}>
                      {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                  {expandedId === t.id && (
                    <tr key={`${t.id}-detail`}>
                      <td colSpan={8} className="p-0">
                        <TraceDetail traceId={t.id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
