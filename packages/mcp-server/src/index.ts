#!/usr/bin/env node
/**
 * Provenant MCP Server
 *
 * Exposes Provenant platform capabilities as MCP tools for use with
 * Claude Desktop, Claude Code, and other MCP-compatible clients.
 *
 * Configuration (environment variables):
 *   PROVENANT_API_KEY   — your Provenant API key (pk_live_...)
 *   PROVENANT_BASE_URL  — base URL of the Provenant API (default: http://localhost:4000)
 *
 * Tools provided:
 *   list_agents         — list all registered agents
 *   get_agent           — get a specific agent with versions
 *   create_session      — start a new conversation session
 *   log_turn            — append a turn to a session
 *   end_session         — mark a session as completed
 *   list_conversations  — list recent conversations
 *   get_overview        — get high-level org metrics
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';

// ── Config ─────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.PROVENANT_BASE_URL ?? 'http://localhost:4000';
const API_KEY = process.env.PROVENANT_API_KEY ?? '';

if (!API_KEY) {
  process.stderr.write(
    'Warning: PROVENANT_API_KEY is not set. Most tools will return 401 errors.\n',
  );
}

const client: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ── Tool definitions ───────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'list_agents',
    description: 'List all registered AI agents in your Provenant organisation, including their status, version count, and session count.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_agent',
    description: 'Get a specific agent by ID, including all versions and their publish status.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'The agent UUID' },
      },
      required: ['agent_id'],
    },
  },
  {
    name: 'create_session',
    description: 'Start a new conversation session for an agent. Returns the session ID which you should use in subsequent log_turn calls.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'The agent UUID to link this session to' },
        agent_version_id: { type: 'string', description: 'Optional: the specific agent version UUID' },
        user_id: { type: 'string', description: 'Optional: identifier for the end user' },
        metadata: { type: 'object', description: 'Optional: arbitrary metadata to attach to the session' },
      },
      required: ['agent_id'],
    },
  },
  {
    name: 'log_turn',
    description: 'Append a message turn to an existing session. Call this for each USER, ASSISTANT, SYSTEM, or TOOL message.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The session UUID (returned by create_session)' },
        role: { type: 'string', enum: ['USER', 'ASSISTANT', 'SYSTEM', 'TOOL'], description: 'Who sent this message' },
        content: { type: 'string', description: 'The text content of the message' },
        input_tokens: { type: 'number', description: 'Optional: number of input tokens' },
        output_tokens: { type: 'number', description: 'Optional: number of output tokens' },
        latency_ms: { type: 'number', description: 'Optional: latency in milliseconds' },
      },
      required: ['session_id', 'role', 'content'],
    },
  },
  {
    name: 'end_session',
    description: 'Mark a session as completed. Call this when the conversation ends.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The session UUID to end' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'list_conversations',
    description: 'List recent conversation sessions across all agents. Supports filtering by agent, status, or full-text search.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Optional: filter by agent UUID' },
        status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'ERROR'], description: 'Optional: filter by status' },
        q: { type: 'string', description: 'Optional: full-text search across conversation content' },
        limit: { type: 'number', description: 'Optional: max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_overview',
    description: 'Get high-level metrics for your Provenant organisation: agent count, total sessions, eval runs, drift reports, and policy violations.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

// ── Tool handlers ──────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'list_agents': {
      const { data } = await client.get('/agents');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2),
        }],
      };
    }

    case 'get_agent': {
      const { data } = await client.get(`/agents/${args.agent_id}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'create_session': {
      const { data } = await client.post('/sessions', {
        agentId: args.agent_id,
        agentVersionId: args.agent_version_id,
        userId: args.user_id,
        metadata: args.metadata ?? {},
      });
      return {
        content: [{
          type: 'text',
          text: `Session created.\nSession ID: ${data.id}\n\nUse this session_id in log_turn and end_session calls.\n\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    case 'log_turn': {
      const { data } = await client.post(`/sessions/${args.session_id}/turns`, {
        role: args.role,
        content: args.content,
        inputTokens: args.input_tokens,
        outputTokens: args.output_tokens,
        latencyMs: args.latency_ms,
      });
      return { content: [{ type: 'text', text: `Turn logged.\nTurn ID: ${data.id}` }] };
    }

    case 'end_session': {
      const { data } = await client.post(`/sessions/${args.session_id}/end`);
      return { content: [{ type: 'text', text: `Session ended.\n${JSON.stringify(data, null, 2)}` }] };
    }

    case 'list_conversations': {
      const params: Record<string, unknown> = {};
      if (args.agent_id) params.agentId = args.agent_id;
      if (args.status) params.status = args.status;
      if (args.q) params.q = args.q;
      const { data } = await client.get('/sessions', { params });
      const sliced = (data as unknown[]).slice(0, (args.limit as number | undefined) ?? 20);
      return { content: [{ type: 'text', text: JSON.stringify(sliced, null, 2) }] };
    }

    case 'get_overview': {
      const { data } = await client.get('/analytics/overview');
      const overview = data as Record<string, number>;
      const summary = [
        `Agents: ${overview.agents}`,
        `Sessions: ${overview.sessions}`,
        `Eval Runs: ${overview.evalRuns}`,
        `Drift Reports: ${overview.driftReports}`,
        `Policy Violations: ${overview.violations}`,
      ].join('\n');
      return { content: [{ type: 'text', text: summary }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Server setup ───────────────────────────────────────────────────────────────

async function main() {
  const server = new Server(
    { name: 'provenant-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      return await callTool(name, args as Record<string, unknown>);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Check for Axios errors
      if (
        err instanceof Error &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
      ) {
        const axErr = err as { response: { data: { error: string }; status: number } };
        return {
          content: [{
            type: 'text',
            text: `Error (HTTP ${axErr.response.status}): ${axErr.response.data.error}`,
          }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('Provenant MCP server running on stdio\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
