import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { estimateCost } from '../lib/pricing';

import type { IRouter } from 'express';
export const sessionsRouter: IRouter = Router();
sessionsRouter.use(authenticate);

sessionsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { agentId, environmentId, status } = req.query as Record<string, string>;
    const sessions = await prisma.session.findMany({
      where: {
        agent: { orgId: req.user!.orgId },
        ...(agentId && { agentId }),
        ...(environmentId && { environmentId }),
        ...(status && { status }),
      },
      include: {
        agent: true,
        environment: true,
        agentVersion: true,
        _count: { select: { turns: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    // Approximate cost using totalTokens (50/50 input/output split)
    const sessionsWithCost = sessions.map((s) => {
      const modelId = s.agentVersion?.modelId ?? '';
      const half = Math.floor((s.totalTokens ?? 0) / 2);
      const costUsd = estimateCost(modelId, half, half);
      return { ...s, costUsd: costUsd > 0 ? costUsd : null };
    });

    res.json(sessionsWithCost);
  } catch (err) { next(err); }
});

sessionsRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, agent: { orgId: req.user!.orgId } },
      include: {
        agent: true,
        environment: true,
        agentVersion: true,
        turns: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) { res.status(404).json({ error: 'Not found' }); return; }

    // Compute cost from per-turn token data
    const modelId = session.agentVersion?.modelId ?? '';
    let totalInput = 0, totalOutput = 0;
    for (const t of session.turns as { inputTokens: number | null; outputTokens: number | null }[]) {
      totalInput += t.inputTokens ?? 0;
      totalOutput += t.outputTokens ?? 0;
    }
    const costUsd = estimateCost(modelId, totalInput, totalOutput);

    res.json({ ...session, costUsd: costUsd > 0 ? costUsd : null });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  agentId: z.string(),
  agentVersionId: z.string().optional(),
  environmentId: z.string().optional(),
  externalId: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
});

sessionsRouter.post('/', auditLog('session.create', 'Session'), async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const agent = await prisma.agent.findFirst({ where: { id: body.agentId, orgId: req.user!.orgId } });
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    const session = await prisma.session.create({
      data: {
        agentId: body.agentId,
        agentVersionId: body.agentVersionId,
        environmentId: body.environmentId,
        externalId: body.externalId,
        userId: body.userId,
        metadata: JSON.stringify(body.metadata),
        tags: JSON.stringify(body.tags),
      },
      include: { agent: true },
    });
    res.status(201).json(session);
  } catch (err) { next(err); }
});

const turnSchema = z.object({
  role: z.enum(['USER', 'ASSISTANT', 'SYSTEM', 'TOOL']),
  content: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
  toolCalls: z.array(z.unknown()).default([]),
  latencyMs: z.number().int().optional(),
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  metadata: z.record(z.unknown()).default({}),
});

sessionsRouter.post('/:id/turns', async (req: AuthRequest, res, next) => {
  try {
    const body = turnSchema.parse(req.body);
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, agent: { orgId: req.user!.orgId } },
    });
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    const { id: sessionId } = req.params;
    const contentValue = typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
    const turn = await prisma.sessionTurn.create({
      data: {
        sessionId,
        role: body.role,
        latencyMs: body.latencyMs,
        inputTokens: body.inputTokens,
        outputTokens: body.outputTokens,
        content: contentValue,
        toolCalls: JSON.stringify(body.toolCalls),
        metadata: JSON.stringify(body.metadata),
      },
    });
    res.status(201).json(turn);
  } catch (err) { next(err); }
});

sessionsRouter.post('/:id/end', auditLog('session.end', 'Session'), async (req: AuthRequest, res, next) => {
  try {
    const { totalTokens, totalLatencyMs } = z.object({
      totalTokens: z.number().int().optional(),
      totalLatencyMs: z.number().int().optional(),
    }).parse(req.body);
    const session = await prisma.session.update({
      where: { id: req.params.id },
      data: { endedAt: new Date(), status: 'COMPLETED', totalTokens, totalLatencyMs },
    });
    res.json(session);
  } catch (err) { next(err); }
});

sessionsRouter.delete('/:id', auditLog('session.delete', 'Session'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.session.deleteMany({
      where: { id: req.params.id, agent: { orgId: req.user!.orgId } },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});
