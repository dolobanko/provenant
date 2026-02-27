export interface ProvenantConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface Agent {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  createdAt: string;
}

export interface Session {
  id: string;
  agentId: string;
  status: string;
  totalTokens?: number;
  totalLatencyMs?: number;
  costUsd?: number;
  startedAt: string;
  endedAt?: string;
}

export interface SessionTurn {
  id: string;
  sessionId: string;
  role: string;
  content: unknown;
  toolCalls: unknown[];
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  createdAt: string;
}

export interface EvalRun {
  id: string;
  suiteId: string;
  agentId: string;
  status: string;
  score?: number;
  passRate?: number;
  startedAt?: string;
  completedAt?: string;
  costUsd?: number;
}

export interface EvalCaseResult {
  id: string;
  caseId: string;
  actualOutput?: string;
  score?: number;
  passed?: boolean;
  latencyMs?: number;
  tokenCount?: number;
  error?: string;
}

export interface CreateSessionOptions {
  agentId: string;
  agentVersionId?: string;
  environmentId?: string;
  externalId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface AddTurnOptions {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: unknown;
  toolCalls?: unknown[];
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface EndSessionOptions {
  status?: 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

export interface CreateEvalRunOptions {
  suiteId: string;
  agentId: string;
  agentVersionId?: string;
  environmentId?: string;
}

export interface SubmitResultOptions {
  caseId: string;
  actualOutput?: string;
  score?: number;
  passed?: boolean;
  latencyMs?: number;
  tokenCount?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WaitForCompletionOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
}

/**
 * Options for `ProvenantClient.withSession()` — all fields are forwarded to
 * `sessions.create()` so they appear on every session in the dashboard.
 */
export interface WithSessionOptions {
  agentVersionId?: string;
  environmentId?: string;
  externalId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}
