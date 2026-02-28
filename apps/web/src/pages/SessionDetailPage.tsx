import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton, SkeletonStat } from '../components/Skeleton';
import { ArrowLeft, User, Bot, Terminal, Wrench, Copy, Check, Wifi } from 'lucide-react';
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
  const qc = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  const { data: session, isLoading } = useQuery<SessionDetail>({
    queryKey: ['session', id],
    queryFn: () => api.get(`/sessions/${id}`).then((r) => r.data),
  });

  // Connect to SSE stream when session is ACTIVE
  useEffect(() => {
    if (!session || session.status !== 'ACTIVE') {
      sseRef.current?.close();
      sseRef.current = null;
      setLiveConnected(false);
      return;
    }

    const token = localStorage.getItem('token');
    const url = `/api/sessions/${id}/stream`;
    // SSE with auth header via URL param workaround (Bearer in query string)
    const es = new EventSource(`${url}?token=${token ?? ''}`);
    sseRef.current = es;

    es.onopen = () => setLiveConnected(true);
    es.onerror = () => setLiveConnected(false);

    es.onmessage = (ev) => {
      try {
        const turn = JSON.parse(ev.data) as Turn & { __type?: string };
        if (turn.__type === 'session.ended') {
          // Refetch the full session to get final status
          qc.invalidateQueries({ queryKey: ['session', id] });
          return;
        }
        // Optimistically append the new turn
        qc.setQueryData<SessionDetail>(['session', id], (prev) => {
          if (!prev) return prev;
          const exists = prev.turns.some((t) => t.id === turn.id);
          if (exists) return prev;
          return { ...prev, turns: [...prev.turns, turn] };
        });
      } catch { /* ignore malformed */ }
    };

    return () => {
      es.close();
      sseRef.current = null;
      setLiveConnected(false);
    };
  }, [session?.status, id, qc]);

  function copyTurnContent(turnId: string, content: unknown) {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedId(turnId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[0,1,2,3].map(i => <SkeletonStat key={i} />)}
        </div>
        <div className="space-y-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }
  if (!session) return <div className="text-red-400 text-sm">Session not found</div>;

  return (
    <div>
      <Link to="/sessions" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Sessions
      </Link>
      <PageHeader
        title={session.agent?.name}
        description={`Session · ${session.environment?.name ?? 'No environment'}${session.agentVersion ? ` · ${session.agentVersion.semver}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            {liveConnected && (
              <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/20 border border-green-800 px-2 py-1 rounded-full">
                <Wifi className="w-3 h-3" /> Live
              </span>
            )}
            <StatusBadge status={session.status} />
          </div>
        }
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
        {session.turns.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No turns captured yet.</p>
            {liveConnected && <p className="text-green-400 text-xs mt-1">Listening for live turns…</p>}
          </div>
        )}
      </div>
    </div>
  );
}
