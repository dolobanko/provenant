import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

import type { IRouter } from 'express';
export const agentsRouter: IRouter = Router();
agentsRouter.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  modelFamily: z.string().optional(),
});

const updateSchema = createSchema.partial();

// List agents
agentsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { orgId: req.user!.orgId },
      include: { _count: { select: { versions: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(agents);
  } catch (err) { next(err); }
});

// Get or create agent by name (idempotent)
agentsRouter.post('/get-or-create', auditLog('agent.get_or_create', 'Agent'), async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      tags: z.array(z.string()).default([]),
      modelFamily: z.string().optional(),
    }).parse(req.body);
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = await prisma.agent.findFirst({ where: { orgId: req.user!.orgId, slug } });
    if (existing) { res.json(existing); return; }
    const agent = await prisma.agent.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        tags: JSON.stringify(body.tags),
        modelFamily: body.modelFamily,
        orgId: req.user!.orgId,
      },
    });
    res.status(201).json(agent);
  } catch (err) { next(err); }
});

// Get agent
agentsRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const agent = await prisma.agent.findFirst({
      where: { id, orgId: req.user!.orgId },
      include: {
        versions: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { versions: true, sessions: true, evalRuns: true } },
      },
    });
    if (!agent) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(agent);
  } catch (err) { next(err); }
});

// Create agent
agentsRouter.post('/', auditLog('agent.create', 'Agent'), async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const agent = await prisma.agent.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        tags: JSON.stringify(body.tags),
        modelFamily: body.modelFamily,
        orgId: req.user!.orgId,
      },
    });
    res.status(201).json(agent);
  } catch (err) { next(err); }
});

// Update agent
agentsRouter.patch('/:id', auditLog('agent.update', 'Agent'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const body = updateSchema.parse(req.body);
    const result = await prisma.agent.updateMany({
      where: { id, orgId: req.user!.orgId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.slug !== undefined && { slug: body.slug }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.tags !== undefined && { tags: JSON.stringify(body.tags) }),
        ...(body.modelFamily !== undefined && { modelFamily: body.modelFamily }),
      },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(await prisma.agent.findUnique({ where: { id } }));
  } catch (err) { next(err); }
});

// Archive agent
agentsRouter.delete('/:id', auditLog('agent.archive', 'Agent'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await prisma.agent.updateMany({
      where: { id, orgId: req.user!.orgId },
      data: { status: 'ARCHIVED' },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Versions ─────────────────────────────────────────────────────────────────

const versionSchema = z.object({
  version: z.string(),
  semver: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/),
  changelog: z.string().optional(),
  systemPrompt: z.string().optional(),
  modelId: z.string().optional(),
  parameters: z.record(z.unknown()).default({}),
  tools: z.array(z.unknown()).default([]),
});

agentsRouter.get('/:id/versions', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const agent = await prisma.agent.findFirst({ where: { id, orgId: req.user!.orgId } });
    if (!agent) { res.status(404).json({ error: 'Not found' }); return; }
    const versions = await prisma.agentVersion.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(versions);
  } catch (err) { next(err); }
});

agentsRouter.post('/:id/versions', auditLog('version.create', 'AgentVersion'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const agent = await prisma.agent.findFirst({ where: { id, orgId: req.user!.orgId } });
    if (!agent) { res.status(404).json({ error: 'Not found' }); return; }
    const body = versionSchema.parse(req.body);
    const version = await prisma.agentVersion.create({
      data: {
        version: body.version,
        semver: body.semver,
        changelog: body.changelog,
        systemPrompt: body.systemPrompt,
        modelId: body.modelId,
        agentId: id,
        parameters: JSON.stringify(body.parameters),
        tools: JSON.stringify(body.tools),
      },
    });
    res.status(201).json(version);
  } catch (err) { next(err); }
});

agentsRouter.patch('/:id/versions/:vId', auditLog('version.update', 'AgentVersion'), async (req: AuthRequest, res, next) => {
  try {
    const { id, vId } = req.params;
    const agent = await prisma.agent.findFirst({ where: { id, orgId: req.user!.orgId } });
    if (!agent) { res.status(404).json({ error: 'Not found' }); return; }
    const body = versionSchema.partial().parse(req.body);
    const version = await prisma.agentVersion.update({
      where: { id: vId },
      data: {
        ...(body.version !== undefined && { version: body.version }),
        ...(body.semver !== undefined && { semver: body.semver }),
        ...(body.changelog !== undefined && { changelog: body.changelog }),
        ...(body.systemPrompt !== undefined && { systemPrompt: body.systemPrompt }),
        ...(body.modelId !== undefined && { modelId: body.modelId }),
        ...(body.parameters !== undefined && { parameters: JSON.stringify(body.parameters) }),
        ...(body.tools !== undefined && { tools: JSON.stringify(body.tools) }),
      },
    });
    res.json(version);
  } catch (err) { next(err); }
});

agentsRouter.post('/:id/versions/:vId/publish', auditLog('version.publish', 'AgentVersion'), async (req: AuthRequest, res, next) => {
  try {
    const { vId } = req.params;
    const version = await prisma.agentVersion.update({
      where: { id: vId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    res.json(version);
  } catch (err) { next(err); }
});

agentsRouter.post('/:id/versions/:vId/deprecate', auditLog('version.deprecate', 'AgentVersion'), async (req: AuthRequest, res, next) => {
  try {
    const { vId } = req.params;
    const version = await prisma.agentVersion.update({
      where: { id: vId },
      data: { status: 'DEPRECATED', deprecatedAt: new Date() },
    });
    res.json(version);
  } catch (err) { next(err); }
});
