import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { Skeleton, SkeletonStat } from '../components/Skeleton';
import { Bot, ChevronRight, Copy, Check, Wifi, ChevronDown } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface Turn {
  id: string;
  role: string;
  content: unknown;
  toolCalls: unknown;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  status: string;
  totalTokens: number | null;
  totalLatencyMs: number | null;
  startedAt: string;
  endedAt: string | null;
  costUsd: number | null;
  agent: { name: string; id: string };
  environment: { name: string; type: string } | null;
  agentVersion: { semver: string } | null;
  turns: Turn[];
}

// ── Content rendering ─────────────────────────────────────────────────────────

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: unknown };

function parseContent(raw: unknown): { textParts: string[]; blocks: ContentBlock[] } {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parseContent(parsed);
      }
    } catch {
      return { textParts: [raw], blocks: [] };
    }
    return { textParts: [raw], blocks: [] };
  }

  if (Array.isArray(raw)) {
    const textParts: string[] = [];
    const blocks: ContentBlock[] = [];
    for (const item of raw as ContentBlock[]) {
      if (item.type === 'text') {
        textParts.push(item.text);
      } else if (item.type === 'tool_use' || item.type === 'tool_result') {
        blocks.push(item);
      }
    }
    return { textParts, blocks };
  }

  if (typeof raw === 'object' && raw !== null) {
    return { textParts: [], blocks: [raw as ContentBlock] };
  }

  return { textParts: [String(raw)], blocks: [] };
}

function CollapsibleBlock({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-gray-800/60 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
      >
        <ChevronDown className={clsx('w-3 h-3 transition-transform', open && 'rotate-180')} />
        {label}
      </button>
      {open && <div className="p-3 bg-gray-950">{children}</div>}
    </div>
  );
}

function TurnBubble({ turn }: { turn: Turn }) {
  const [copied, setCopied] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const { textParts, blocks } = parseContent(turn.content);

  function copyContent() {
    const text = typeof turn.content === 'string' ? turn.content : JSON.stringify(turn.content, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // SYSTEM — centered, muted, collapsible
  if (turn.role === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <CollapsibleBlock label="System prompt">
          <p className="text-xs text-gray-400 font-mono whitespace-pre-wrap leading-relaxed">
            {textParts.join('\n') || JSON.stringify(turn.content, null, 2)}
          </p>
        </CollapsibleBlock>
      </div>
    );
  }

  // TOOL — left-aligned, monospace, dark green, collapsible
  if (turn.role === 'TOOL') {
    return (
      <div className="flex items-start gap-2 max-w-2xl">
        <div className="w-6 h-6 rounded-full bg-green-900/40 border border-green-800/50 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-green-400 text-xs">⚙</span>
        </div>
        <div className="flex-1 min-w-0">
          <CollapsibleBlock label="Tool result">
            <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {typeof turn.content === 'string' ? turn.content : JSON.stringify(turn.content, null, 2)}
            </pre>
          </CollapsibleBlock>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
            {turn.latencyMs != null && <span>{turn.latencyMs < 1000 ? `${turn.latencyMs}ms` : `${(turn.latencyMs / 1000).toFixed(1)}s`}</span>}
          </div>
        </div>
      </div>
    );
  }

  const isUser = turn.role === 'USER';

  return (
    <div
      className={clsx('flex items-end gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      {/* Avatar — assistant only */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 mb-1">
          <Bot className="w-3.5 h-3.5 text-gray-400" />
        </div>
      )}

      <div className={clsx('max-w-[70%] min-w-0', isUser ? 'items-end' : 'items-start', 'flex flex-col gap-1')}>
        {/* Bubble */}
        <div
          className={clsx(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-brand-600 text-white rounded-br-sm'
              : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-sm',
          )}
        >
          {textParts.length > 0 && (
            <p className="whitespace-pre-wrap">{textParts.join('\n')}</p>
          )}

          {/* Tool use blocks inside assistant bubble */}
          {blocks.filter((b) => b.type === 'tool_use').map((b, i) => {
            const tb = b as { type: 'tool_use'; name: string; input: Record<string, unknown> };
            return (
              <CollapsibleBlock key={i} label={`Tool call: ${tb.name}`}>
                <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap">
                  {JSON.stringify(tb.input, null, 2)}
                </pre>
              </CollapsibleBlock>
            );
          })}

          {textParts.length === 0 && blocks.length === 0 && (
            <p className="text-xs text-gray-500 italic">Empty message</p>
          )}
        </div>

        {/* Metadata */}
        <div className={clsx('flex items-center gap-2 text-xs text-gray-600', isUser ? 'flex-row-reverse' : 'flex-row')}>
          {turn.latencyMs != null && (
            <span>{turn.latencyMs < 1000 ? `${turn.latencyMs}ms` : `${(turn.latencyMs / 1000).toFixed(1)}s`}</span>
          )}
          {turn.inputTokens != null && <span>{turn.inputTokens}↑</span>}
          {turn.outputTokens != null && <span>{turn.outputTokens}↓</span>}

          {/* Timestamp on hover */}
          <span
            className={clsx(
              'transition-opacity',
              showTime ? 'opacity-100' : 'opacity-0',
            )}
          >
            {format(new Date(turn.createdAt), 'HH:mm:ss')}
          </span>

          {/* Copy button */}
          <button
            onClick={copyContent}
            className="opacity-0 group-hover:opacity-100 hover:text-gray-400 transition-all"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const ENV_COLORS: Record<string, string> = {
  PRODUCTION: 'bg-green-900/40 text-green-400',
  STAGING: 'bg-yellow-900/40 text-yellow-400',
  DEVELOPMENT: 'bg-blue-900/40 text-blue-400',
};

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [liveConnected, setLiveConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  const { data: session, isLoading } = useQuery<ConversationDetail>({
    queryKey: ['session', id],
    queryFn: () => api.get(`/sessions/${id}`).then((r) => r.data),
  });

  // SSE streaming for active sessions
  useEffect(() => {
    if (!session || session.status !== 'ACTIVE') {
      sseRef.current?.close();
      sseRef.current = null;
      setLiveConnected(false);
      return;
    }

    const token = localStorage.getItem('token') ?? '';
    const es = new EventSource(`/api/sessions/${id}/stream?token=${token}`);
    sseRef.current = es;
    es.onopen = () => setLiveConnected(true);
    es.onerror = () => setLiveConnected(false);
    es.onmessage = (ev) => {
      try {
        const turn = JSON.parse(ev.data) as Turn & { __type?: string };
        if (turn.__type === 'session.ended') {
          qc.invalidateQueries({ queryKey: ['session', id] });
          return;
        }
        qc.setQueryData<ConversationDetail>(['session', id], (prev) => {
          if (!prev) return prev;
          if (prev.turns.some((t) => t.id === turn.id)) return prev;
          return { ...prev, turns: [...prev.turns, turn] };
        });
      } catch { /* ignore */ }
    };
    return () => { es.close(); sseRef.current = null; setLiveConnected(false); };
  }, [session?.status, id, qc]);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-4 w-48 mb-6" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-40 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => <SkeletonStat key={i} />)}
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (!session) return <div className="text-red-400 text-sm">Conversation not found</div>;

  const envColor = ENV_COLORS[session.environment?.type ?? ''] ?? 'bg-gray-800 text-gray-400';

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link to="/conversations" className="hover:text-gray-300 transition-colors">
          Conversations
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-300">{session.agent?.name}</span>
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{session.agent?.name}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {session.agentVersion && (
              <span className="badge badge-gray font-mono">v{session.agentVersion.semver}</span>
            )}
            {session.environment && (
              <span className={clsx('badge text-xs', envColor)}>{session.environment.name}</span>
            )}
            <span className="text-xs text-gray-500">
              Started {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {liveConnected && (
            <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/20 border border-green-800 px-2.5 py-1 rounded-full">
              <Wifi className="w-3 h-3" /> Live
            </span>
          )}
          <StatusBadge status={session.status} />
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-white">{session.turns.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Messages</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-white">
            {session.totalTokens?.toLocaleString() ?? '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Tokens</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-white">
            {session.totalLatencyMs != null
              ? `${(session.totalLatencyMs / 1000).toFixed(1)}s`
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Total Latency</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-white">
            {session.costUsd != null ? `$${session.costUsd.toFixed(4)}` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Est. Cost</p>
        </div>
      </div>

      {/* Conversation thread */}
      <div className="group">
        {session.turns.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">No messages yet.</p>
            {liveConnected && (
              <p className="text-green-400 text-xs mt-1">Listening for live messages…</p>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {session.turns.map((turn) => (
              <TurnBubble key={turn.id} turn={turn} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
