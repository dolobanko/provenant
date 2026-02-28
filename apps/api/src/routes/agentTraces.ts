import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

import type { IRouter } from 'express';
export const agentTracesRouter: IRouter = Router();
agentTracesRouter.use(authenticate);

// ── Validation ─────────────────────────────────────────────────────────────────

const fileAttributionSchema = z.object({
  path: z.string(),
  attributions: z.array(z.object({
    model: z.string(),
    lines: z.array(z.tuple([z.number(), z.number()])).optional(),
    conversationUrl: z.string().url().optional(),
    aiLines: z.number().int().min(0).optional(),
    humanLines: z.number().int().min(0).optional(),
    mixedLines: z.number().int().min(0).optional(),
  })).default([]),
});

const traceSchema = z.object({
  specVersion: z.string().default('0.1.0'),
  traceId: z.string().min(1),
  agentVersionId: z.string().uuid().optional(),
  vcsType: z.string().optional(),
  vcsRevision: z.string().optional(),
  toolName: z.string().optional(),
  toolVersion: z.string().optional(),
  files: z.array(fileAttributionSchema).default([]),
  metadata: z.record(z.unknown()).default({}),
  source: z.string().default('API'),
});

// ── POST /api/agent-traces — ingest a trace ───────────────────────────────────

agentTracesRouter.post(
  '/',
  auditLog('agent_trace.create', 'AgentTrace'),
  async (req: AuthRequest, res, next) => {
    try {
      const agentVersionId = (req.query.agentVersionId as string | undefined) ?? req.body.agentVersionId;
      const body = traceSchema.parse({ ...req.body, agentVersionId });

      // Verify agentVersionId belongs to org if provided
      if (body.agentVersionId) {
        const version = await prisma.agentVersion.findFirst({
          where: {
            id: body.agentVersionId,
            agent: { orgId: req.user!.orgId },
          },
        });
        if (!version) {
          res.status(404).json({ error: 'Agent version not found or not in your org' });
          return;
        }
      }

      const trace = await prisma.agentTrace.create({
        data: {
          orgId: req.user!.orgId,
          agentVersionId: body.agentVersionId ?? null,
          specVersion: body.specVersion,
          traceId: body.traceId,
          vcsType: body.vcsType ?? null,
          vcsRevision: body.vcsRevision ?? null,
          toolName: body.toolName ?? null,
          toolVersion: body.toolVersion ?? null,
          files: JSON.stringify(body.files),
          metadata: JSON.stringify(body.metadata),
          source: body.source,
        },
        include: { agentVersion: { select: { semver: true, version: true } } },
      });

      res.status(201).json({ ...trace, files: body.files, metadata: body.metadata });
    } catch (err) { next(err); }
  },
);

// ── GET /api/agent-traces — list for org ─────────────────────────────────────

agentTracesRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { agentVersionId } = req.query as Record<string, string | undefined>;
    const traces = await prisma.agentTrace.findMany({
      where: {
        orgId: req.user!.orgId,
        ...(agentVersionId ? { agentVersionId } : {}),
      },
      include: {
        agentVersion: {
          select: { semver: true, version: true, agentId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Parse JSON fields and attach light summary (no full files array)
    const result = traces.map((t) => {
      let files: unknown[] = [];
      try { files = JSON.parse(t.files) as unknown[]; } catch { /* ignore */ }
      return {
        ...t,
        fileCount: files.length,
        files: undefined, // omit from list; use GET /:id for full detail
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/agent-traces/:id — single trace with full files ──────────────────

agentTracesRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const trace = await prisma.agentTrace.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: {
        agentVersion: {
          select: { semver: true, version: true, agentId: true, agent: { select: { name: true } } },
        },
      },
    });
    if (!trace) { res.status(404).json({ error: 'Not found' }); return; }

    let files: unknown = [];
    let metadata: unknown = {};
    try { files = JSON.parse(trace.files); } catch { /* ignore */ }
    try { metadata = JSON.parse(trace.metadata); } catch { /* ignore */ }

    res.json({ ...trace, files, metadata });
  } catch (err) { next(err); }
});

// ── DELETE /api/agent-traces/:id ──────────────────────────────────────────────

agentTracesRouter.delete(
  '/:id',
  auditLog('agent_trace.delete', 'AgentTrace'),
  async (req: AuthRequest, res, next) => {
    try {
      const deleted = await prisma.agentTrace.deleteMany({
        where: { id: req.params.id, orgId: req.user!.orgId },
      });
      if (deleted.count === 0) { res.status(404).json({ error: 'Not found' }); return; }
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);
