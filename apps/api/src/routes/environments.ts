import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

import type { IRouter } from 'express';
export const environmentsRouter: IRouter = Router();
environmentsRouter.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  type: z.enum(['DEVELOPMENT', 'STAGING', 'PRODUCTION', 'CUSTOM']).default('CUSTOM'),
  description: z.string().optional(),
  requiresApproval: z.boolean().default(false),
});

environmentsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const envs = await prisma.environment.findMany({
      where: { orgId: req.user!.orgId },
      include: { _count: { select: { configs: true } } },
      orderBy: { type: 'asc' },
    });
    res.json(envs);
  } catch (err) { next(err); }
});

environmentsRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const env = await prisma.environment.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: { configs: { include: { agent: true } } },
    });
    if (!env) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(env);
  } catch (err) { next(err); }
});

environmentsRouter.post('/', auditLog('environment.create', 'Environment'), async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const env = await prisma.environment.create({ data: { ...body, orgId: req.user!.orgId } });
    res.status(201).json(env);
  } catch (err) { next(err); }
});

environmentsRouter.patch('/:id', auditLog('environment.update', 'Environment'), async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.partial().parse(req.body);
    const env = await prisma.environment.updateMany({
      where: { id: req.params.id, orgId: req.user!.orgId },
      data: body,
    });
    if (env.count === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(await prisma.environment.findUnique({ where: { id: req.params.id } }));
  } catch (err) { next(err); }
});

// ─── Promotions ───────────────────────────────────────────────────────────────

const promoteSchema = z.object({
  agentVersionId: z.string(),
  fromEnvId: z.string().optional(),
  toEnvId: z.string(),
  notes: z.string().optional(),
});

environmentsRouter.post('/promotions', auditLog('promotion.create', 'EnvironmentPromotion'), async (req: AuthRequest, res, next) => {
  try {
    const body = promoteSchema.parse(req.body);
    const toEnv = await prisma.environment.findFirst({ where: { id: body.toEnvId, orgId: req.user!.orgId } });
    if (!toEnv) { res.status(404).json({ error: 'Target environment not found' }); return; }

    const status = toEnv.requiresApproval ? 'AWAITING_APPROVAL' : 'PENDING';
    const promotion = await prisma.environmentPromotion.create({
      data: {
        agentVersionId: body.agentVersionId,
        fromEnvId: body.fromEnvId,
        toEnvId: body.toEnvId,
        notes: body.notes,
        triggeredBy: req.user!.id,
        status,
      },
      include: { agentVersion: true, toEnv: true, fromEnv: true },
    });
    res.status(201).json(promotion);
  } catch (err) { next(err); }
});

environmentsRouter.get('/promotions', async (req: AuthRequest, res, next) => {
  try {
    const promotions = await prisma.environmentPromotion.findMany({
      where: {
        toEnv: { orgId: req.user!.orgId },
      },
      include: { agentVersion: { include: { agent: true } }, toEnv: true, fromEnv: true, approvals: { include: { user: { select: { id: true, name: true, email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(promotions);
  } catch (err) { next(err); }
});

environmentsRouter.post('/promotions/:id/approve', auditLog('promotion.approve', 'EnvironmentPromotion'), async (req: AuthRequest, res, next) => {
  try {
    const { comment } = z.object({ comment: z.string().optional() }).parse(req.body);
    await prisma.approvalDecision.create({
      data: { promotionId: req.params.id, userId: req.user!.id, decision: 'APPROVED', comment },
    });
    const updated = await prisma.environmentPromotion.update({
      where: { id: req.params.id },
      data: { status: 'PROMOTED', promotedAt: new Date() },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

environmentsRouter.post('/promotions/:id/reject', auditLog('promotion.reject', 'EnvironmentPromotion'), async (req: AuthRequest, res, next) => {
  try {
    const { comment } = z.object({ comment: z.string().optional() }).parse(req.body);
    await prisma.approvalDecision.create({
      data: { promotionId: req.params.id, userId: req.user!.id, decision: 'REJECTED', comment },
    });
    const updated = await prisma.environmentPromotion.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
    });
    res.json(updated);
  } catch (err) { next(err); }
});
