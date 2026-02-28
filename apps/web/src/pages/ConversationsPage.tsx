import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { CardGridSkeleton } from '../components/Skeleton';
import { MessageSquare, Search, Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface Agent { id: string; name: string; }
interface Session {
  id: string;
  status: string;
  startedAt: string;
  costUsd: number | null;
  totalTokens: number | null;
  totalLatencyMs: number | null;
  agent: { name: string; id: string };
  agentVersion: { semver: string } | null;
  environment: { name: string; type: string } | null;
  _count: { turns: number };
}

const ENV_COLORS: Record<string, string> = {
  PRODUCTION: 'bg-green-900/40 text-green-400 border-green-800/50',
  STAGING: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
  DEVELOPMENT: 'bg-blue-900/40 text-blue-400 border-blue-800/50',
  CUSTOM: 'bg-purple-900/40 text-purple-400 border-purple-800/50',
};

function ConversationCard({ session }: { session: Session }) {
  const envType = session.environment?.type ?? '';
  const envColor = ENV_COLORS[envType] ?? 'bg-gray-800 text-gray-400 border-gray-700';

  return (
    <Link
      to={`/conversations/${session.id}`}
      className="card hover:border-gray-700 transition-all group block"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-brand-400 transition-colors">
              {session.agent?.name}
            </p>
            {session.agentVersion && (
              <span className="text-xs text-gray-600 font-mono">v{session.agentVersion.semver}</span>
            )}
          </div>
        </div>
        <StatusBadge status={session.status} />
      </div>

      {/* Message preview placeholder */}
      <p className="text-sm text-gray-500 mb-3 leading-relaxed line-clamp-2">
        {session._count.turns > 0
          ? `${session._count.turns} message${session._count.turns !== 1 ? 's' : ''} in this conversation`
          : 'Session started, no messages yet'}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 flex-wrap">
        <span>{session._count.turns} turn{session._count.turns !== 1 ? 's' : ''}</span>
        {session.totalTokens != null && (
          <span>{session.totalTokens.toLocaleString()} tokens</span>
        )}
        {session.costUsd != null && (
          <span>${session.costUsd.toFixed(4)}</span>
        )}
        {session.totalLatencyMs != null && (
          <span>
            {session.totalLatencyMs < 1000
              ? `${session.totalLatencyMs}ms`
              : `${(session.totalLatencyMs / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">
          {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
        </span>
        {session.environment && (
          <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', envColor)}>
            {session.environment.name}
          </span>
        )}
      </div>
    </Link>
  );
}

const STATUS_FILTERS = ['All', 'ACTIVE', 'COMPLETED'] as const;

export function ConversationsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [agentFilter, setAgentFilter] = useState<string>('All');

  // Debounce search input by 400ms before sending to API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ['sessions', debouncedSearch, statusFilter, agentFilter],
    queryFn: () => api.get('/sessions', {
      params: {
        ...(debouncedSearch.trim() && { q: debouncedSearch.trim() }),
        ...(statusFilter !== 'All' && { status: statusFilter }),
        ...(agentFilter !== 'All' && { agentId: agentFilter }),
      },
    }).then((r) => r.data),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data),
  });

  // Client-side filter is now only needed for agent dropdown (already sent to API)
  // but we keep the variable name `filtered` for compatibility
  const filtered = useMemo(() => sessions, [sessions]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Conversations</h1>
          <p className="text-sm text-gray-400 mt-1">Every interaction your AI agents have with users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by agent name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 py-2 text-sm w-full"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-gray-800/60 p-1 rounded-lg border border-gray-700">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-gray-200',
              )}
            >
              {s === 'All' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Agent filter */}
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="input py-2 text-sm min-w-40"
        >
          <option value="All">All Agents</option>
          {(agents as Agent[]).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Result count */}
        {!isLoading && (
          <span className="text-xs text-gray-500 ml-auto">
            {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <CardGridSkeleton count={9} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations found"
          description={
            search || statusFilter !== 'All' || agentFilter !== 'All'
              ? 'Try adjusting your filters.'
              : 'Conversations are created via the API when agents are invoked.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <ConversationCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
