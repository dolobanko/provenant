import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Provenant API',
      version: '0.1.0',
      description: 'Business Intelligence platform for AI agents. Instrument your agents, capture conversations, run evaluations, detect drift, and enforce governance policies.',
      contact: { name: 'Provenant', url: 'https://provenant.dev' },
    },
    servers: [{ url: '/api', description: 'Current server' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT or API Key', description: 'Use a JWT (from /auth/login) or a Provenant API Key (pk_live_...)' },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Register, login, password reset, GitHub OAuth' },
      { name: 'Agents', description: 'Agent registry and version management' },
      { name: 'Sessions', description: 'Conversation capture and turn logging' },
      { name: 'Evals', description: 'Evaluation suites, cases, and runs' },
      { name: 'Drift', description: 'Drift detection reports and baselines' },
      { name: 'Policies', description: 'Governance policies and violations' },
      { name: 'Analytics', description: 'Time-series and aggregated metrics' },
      { name: 'Agent Traces', description: 'AI code attribution (agent-trace.dev spec)' },
      { name: 'Proxy', description: 'Claude API proxy with automatic session logging' },
      { name: 'Audit', description: 'Immutable audit log' },
      { name: 'Org', description: 'Organization settings, API keys, team management' },
    ],
    paths: {
      // ── Auth ──────────────────────────────────────────────────────────────
      '/auth/register': {
        post: {
          tags: ['Auth'], summary: 'Register a new account',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 } } } } } },
          responses: { 201: { description: 'User created, returns JWT token' }, 409: { description: 'Email already registered' } },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'], summary: 'Log in with email and password',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } } } } },
          responses: { 200: { description: 'Returns JWT token and user object' }, 401: { description: 'Invalid credentials' } },
        },
      },
      '/auth/me': {
        get: { tags: ['Auth'], summary: 'Get current authenticated user', responses: { 200: { description: 'User profile' } } },
      },
      '/auth/github': {
        get: { tags: ['Auth'], summary: 'Initiate GitHub OAuth flow', security: [], responses: { 302: { description: 'Redirect to GitHub' } } },
      },

      // ── Agents ─────────────────────────────────────────────────────────────
      '/agents': {
        get: { tags: ['Agents'], summary: 'List all agents for your org', responses: { 200: { description: 'Array of agents with version + session counts' } } },
        post: {
          tags: ['Agents'], summary: 'Create a new agent',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' }, modelFamily: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } } } } },
          responses: { 201: { description: 'Agent created' } },
        },
      },
      '/agents/{id}': {
        get: { tags: ['Agents'], summary: 'Get agent with all versions', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Agent detail' }, 404: { description: 'Not found' } } },
      },
      '/agents/{id}/versions': {
        post: {
          tags: ['Agents'], summary: 'Create a new version for an agent',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['version', 'semver'], properties: { version: { type: 'string', description: 'Human-readable label e.g. "v2 with tools"' }, semver: { type: 'string', example: '1.0.0' }, modelId: { type: 'string', example: 'claude-sonnet-4-5' }, systemPrompt: { type: 'string' }, changelog: { type: 'string' } } } } } },
          responses: { 201: { description: 'Version created with DRAFT status' } },
        },
      },
      '/agents/{id}/versions/{vId}/publish': {
        post: { tags: ['Agents'], summary: 'Publish a version (DRAFT → PUBLISHED)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }, { in: 'path', name: 'vId', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Version published' } } },
      },

      // ── Sessions ────────────────────────────────────────────────────────────
      '/sessions': {
        get: {
          tags: ['Sessions'], summary: 'List conversations / sessions',
          parameters: [
            { in: 'query', name: 'agentId', schema: { type: 'string' } },
            { in: 'query', name: 'status', schema: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'ERROR'] } },
            { in: 'query', name: 'q', schema: { type: 'string' }, description: 'Full-text search across turn content' },
          ],
          responses: { 200: { description: 'Array of sessions with cost estimate' } },
        },
        post: {
          tags: ['Sessions'], summary: 'Start a new conversation session',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string' }, agentVersionId: { type: 'string' }, environmentId: { type: 'string' }, userId: { type: 'string' }, metadata: { type: 'object' } } } } } },
          responses: { 201: { description: 'Session created' } },
        },
      },
      '/sessions/{id}/turns': {
        post: {
          tags: ['Sessions'], summary: 'Append a turn (message) to a session',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['role', 'content'], properties: { role: { type: 'string', enum: ['USER', 'ASSISTANT', 'SYSTEM', 'TOOL'] }, content: { type: 'string' }, toolCalls: { type: 'array', items: { type: 'object' } }, inputTokens: { type: 'number' }, outputTokens: { type: 'number' }, latencyMs: { type: 'number' } } } } } },
          responses: { 201: { description: 'Turn added' } },
        },
      },
      '/sessions/{id}/end': {
        post: { tags: ['Sessions'], summary: 'End a session (mark COMPLETED)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Session ended' } } },
      },

      // ── Analytics ───────────────────────────────────────────────────────────
      '/analytics/overview': {
        get: { tags: ['Analytics'], summary: 'High-level org metrics (counts)', responses: { 200: { description: '{ agents, sessions, evalRuns, driftReports, violations }' } } },
      },
      '/analytics/timeseries': {
        get: {
          tags: ['Analytics'], summary: 'Daily conversations + cost over time',
          parameters: [{ in: 'query', name: 'days', schema: { type: 'integer', default: 30, maximum: 90 }, description: 'Number of days back (max 90)' }],
          responses: { 200: { description: 'Array of { date, conversations, costUsd }' } },
        },
      },
      '/analytics/eval-trend': {
        get: { tags: ['Analytics'], summary: '30-day eval pass rate trend (daily avg)', responses: { 200: { description: 'Array of { date, passRate }' } } },
      },
      '/analytics/session-volume': {
        get: { tags: ['Analytics'], summary: '30-day session volume (daily count)', responses: { 200: { description: 'Array of { date, count }' } } },
      },

      // ── Agent Traces ────────────────────────────────────────────────────────
      '/agent-traces': {
        get: { tags: ['Agent Traces'], summary: 'List AI authorship traces for your org', parameters: [{ in: 'query', name: 'agentVersionId', schema: { type: 'string' } }], responses: { 200: { description: 'Array of traces (without file arrays, includes fileCount)' } } },
        post: {
          tags: ['Agent Traces'], summary: 'Ingest an AI authorship trace (agent-trace.dev spec)',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['traceId', 'files'], properties: { specVersion: { type: 'string', default: '0.1.0' }, traceId: { type: 'string' }, agentVersionId: { type: 'string' }, vcsType: { type: 'string', example: 'git' }, vcsRevision: { type: 'string' }, toolName: { type: 'string', example: 'claude-code' }, toolVersion: { type: 'string' }, files: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, attributions: { type: 'array', items: { type: 'object', properties: { model: { type: 'string' }, aiLines: { type: 'integer' }, humanLines: { type: 'integer' }, conversationUrl: { type: 'string', format: 'uri' } } } } } } } } } } } },
          responses: { 201: { description: 'Trace ingested' } },
        },
      },
      '/agent-traces/{id}': {
        get: { tags: ['Agent Traces'], summary: 'Get full trace including file attributions', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Trace detail with parsed files array' } } },
        delete: { tags: ['Agent Traces'], summary: 'Delete a trace', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'Deleted' } } },
      },

      // ── Proxy ───────────────────────────────────────────────────────────────
      '/proxy/messages': {
        post: {
          tags: ['Proxy'], summary: 'Claude API proxy — auto-logs to Provenant session',
          description: 'Drop-in for https://api.anthropic.com/v1/messages. Requires x-anthropic-key header. Optionally x-agent-id or x-session-id.',
          parameters: [
            { in: 'header', name: 'x-anthropic-key', required: true, schema: { type: 'string' }, description: 'Your Anthropic API key' },
            { in: 'header', name: 'x-agent-id', schema: { type: 'string' }, description: 'Provenant agent ID to link the session to' },
            { in: 'header', name: 'x-session-id', schema: { type: 'string' }, description: 'Existing Provenant session ID to reuse' },
          ],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', description: 'Standard Anthropic Messages API request body' } } } },
          responses: { 200: { description: 'Anthropic API response (transparent passthrough). Response header x-provenant-session-id contains the session ID.' } },
        },
      },

      // ── Org ─────────────────────────────────────────────────────────────────
      '/org/settings': {
        get: { tags: ['Org'], summary: 'Get org settings (name, slug, slackWebhookUrl)', responses: { 200: { description: 'Org settings' } } },
        patch: {
          tags: ['Org'], summary: 'Update org settings',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { slackWebhookUrl: { type: 'string', format: 'uri', nullable: true, description: 'Slack incoming webhook URL for drift/policy alerts' } } } } } },
          responses: { 200: { description: 'Updated org settings' } },
        },
      },
      '/org/keys': {
        get: { tags: ['Org'], summary: 'List API keys', responses: { 200: { description: 'API keys (key value only shown on creation)' } } },
        post: { tags: ['Org'], summary: 'Create an API key', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' } } } } } }, responses: { 201: { description: 'API key created — full key only shown once' } } },
      },

      // ── Drift ───────────────────────────────────────────────────────────────
      '/drift/reports': {
        get: { tags: ['Drift'], summary: 'List drift reports', parameters: [{ in: 'query', name: 'agentId', schema: { type: 'string' } }, { in: 'query', name: 'severity', schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] } }], responses: { 200: { description: 'Drift reports' } } },
        post: { tags: ['Drift'], summary: 'Submit a drift report', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['agentId', 'driftScore', 'severity', 'dimensions'], properties: { agentId: { type: 'string' }, driftScore: { type: 'number', minimum: 0, maximum: 1 }, severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }, dimensions: { type: 'object', description: 'Key-value map of drift dimension scores' } } } } } }, responses: { 201: { description: 'Report created. Fires Slack alert if severity is HIGH or CRITICAL.' } } },
      },

      // ── Evals ───────────────────────────────────────────────────────────────
      '/evals/suites': {
        get: { tags: ['Evals'], summary: 'List eval suites', responses: { 200: { description: 'Suites with case + run counts' } } },
        post: { tags: ['Evals'], summary: 'Create an eval suite', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } } } } }, responses: { 201: { description: 'Suite created' } } },
      },
      '/evals/runs': {
        get: { tags: ['Evals'], summary: 'List all eval runs across org', responses: { 200: { description: 'Runs with suite + agent info' } } },
        post: { tags: ['Evals'], summary: 'Trigger an eval run', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['suiteId', 'agentId'], properties: { suiteId: { type: 'string' }, agentId: { type: 'string' }, agentVersionId: { type: 'string' } } } } } }, responses: { 201: { description: 'Run started asynchronously' } } },
      },

      // ── Policies ────────────────────────────────────────────────────────────
      '/policies': {
        get: { tags: ['Policies'], summary: 'List governance policies', responses: { 200: { description: 'Policies' } } },
        post: { tags: ['Policies'], summary: 'Create a policy', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'type'], properties: { name: { type: 'string' }, type: { type: 'string', enum: ['DEPLOYMENT', 'CONTENT', 'RATE_LIMIT', 'DATA_PRIVACY', 'APPROVAL'] }, rules: { type: 'array', items: { type: 'object' } }, isEnabled: { type: 'boolean' }, enforcementLevel: { type: 'string', enum: ['WARN', 'BLOCK', 'NOTIFY'] } } } } } }, responses: { 201: { description: 'Policy created' } } },
      },
      '/policies/violations': {
        get: { tags: ['Policies'], summary: 'List policy violations', responses: { 200: { description: 'Violations with policy info' } } },
        post: { tags: ['Policies'], summary: 'Report a policy violation', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['policyId', 'resourceId', 'resourceType', 'severity'], properties: { policyId: { type: 'string' }, resourceId: { type: 'string' }, resourceType: { type: 'string' }, severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }, details: { type: 'object' } } } } } }, responses: { 201: { description: 'Violation logged. Fires Slack alert.' } } },
      },

      // ── Audit ────────────────────────────────────────────────────────────────
      '/audit': {
        get: { tags: ['Audit'], summary: 'Query audit log', parameters: [{ in: 'query', name: 'action', schema: { type: 'string' } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } }], responses: { 200: { description: 'Audit log entries' } } },
      },
    },
  },
  apis: [], // We define paths inline above
});
