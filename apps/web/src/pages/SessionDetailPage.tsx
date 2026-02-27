import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ArrowLeft, User, Bot, Terminal, Wrench, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

interface Turn { id: string; role: string; content: unknown; toolCalls: unknown[]; latencyMs: number | null; inputTokens: number | null; outputTokens: number | null; createdAt: string; }
interface SessionDetail { id: string; status: string; totalTokens: number | null; totalLatencyMs: number | null; startedAt: string; endedAt: string | null; costUsd: number | null; agent: { name: string }; environment: { name: string } | null; agentVersion: { semver: string } | null; turns: Turn[]; }

const roleIcon: Record<string, React.ReactNode> = {
  USER: <User className="w-4 h-4 text-blue-400" />,
  ASSISTANT: <Bot className="w-4 h-4 text-green-400" />,
  SYSTEM: <Terminal className="w-4 h-4 text-purple-400" />,
  TOOL: <Wrench className="w-4 h-4 text-yellow-400" />,
};

const roleBg: Record<string, string> = {
  USER: 'border-blue-800',
  ASSISTANT: 'border-green-800',
  SYSTEM: 'border-purple-800',
  TOOL: 'border-yellow-800',
};

function renderContent(content: unknown, role: string): React.ReactNode {
  const isJsonLike = typeof content === 'object' && content !== null;
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  if (role === 'TOOL' || isJsonLike) {
    return (
      <pre className="text-xs font-mono text-green-300 bg-gray-950 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-5 max-h-64 overflow-y-auto">
        {text}
      </pre>
    );
  }
  return <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">{text}</p>;
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: session, isLoading } = useQuery<SessionDetail>({
    queryKey: ['session', id],
    queryFn: () => api.get(`/sessions/${id}`).then((r) => r.data),
  });

  function copyTurnContent(turnId: string, content: unknown) {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedId(turnId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>;
  if (!session) return <div className="text-red-400 text-sm">Session not found</div>;

  return (
    <div>
      <Link to="/sessions" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Sessions
      </Link>
      <PageHeader
        title={session.agent?.name}
        description={`Session · ${session.environment?.name ?? 'No environment'}${session.agentVersion ? ` · ${session.agentVersion.semver}` : ''}`}
        action={<StatusBadge status={session.status} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card text-center"><p className="text-2xl font-bold text-white">{session.turns.length}</p><p className="text-sm text-gray-400">Turns</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{session.totalTokens?.toLocaleString() ?? '—'}</p><p className="text-sm text-gray-400">Tokens</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{session.totalLatencyMs != null ? `${(session.totalLatencyMs / 1000).toFixed(1)}s` : '—'}</p><p className="text-sm text-gray-400">Total Latency</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-white">{session.costUsd != null ? `$${session.costUsd.toFixed(4)}` : '—'}</p><p className="text-sm text-gray-400">Est. Cost</p></div>
      </div>

      <div className="space-y-3">
        {session.turns.map((turn) => {
          const isStructured = (typeof turn.content === 'object' && turn.content !== null) || turn.role === 'TOOL';
          return (
            <div key={turn.id} className={clsx('bg-gray-900 rounded-xl border p-4', roleBg[turn.role] ?? 'border-gray-800')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {roleIcon[turn.role]}
                  <span className="text-xs font-semibold text-gray-400 uppercase">{turn.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  {turn.latencyMs != null && (
                    <span className="badge badge-gray text-xs">
                      {turn.latencyMs < 1000 ? `${turn.latencyMs}ms` : `${(turn.latencyMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  {turn.inputTokens != null && <span className="badge badge-blue text-xs" title="Input tokens">{turn.inputTokens}↑</span>}
                  {turn.outputTokens != null && <span className="badge badge-purple text-xs" title="Output tokens">{turn.outputTokens}↓</span>}
                  <span className="text-xs text-gray-600">{format(new Date(turn.createdAt), 'HH:mm:ss')}</span>
                  {isStructured && (
                    <button onClick={() => copyTurnContent(turn.id, turn.content)} className="text-gray-500 hover:text-gray-300 flex items-center gap-1 text-xs transition-colors">
                      {copiedId === turn.id ? <><Check className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  )}
                </div>
              </div>
              {renderContent(turn.content, turn.role)}
            </div>
          );
        })}
        {session.turns.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No turns captured yet.</p>}
      </div>
    </div>
  );
}
