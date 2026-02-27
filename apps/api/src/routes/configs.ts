import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

import type { IRouter } from 'express';
export const configsRouter: IRouter = Router();
configsRouter.use(authenticate);

const upsertSchema = z.object({
  agentId: z.string(),
  environmentId: z.string(),
  config: z.record(z.unknown()).default({}),
  overrides: z.record(z.unknown()).default({}),
  inheritFrom: z.string().optional(),
});

const secretSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

configsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { agentId, environmentId } = req.query as Record<string, string>;
    const configs = await prisma.agentConfig.findMany({
      where: {
        agent: { orgId: req.user!.orgId },
        ...(agentId && { agentId }),
        ...(environmentId && { environmentId }),
      },
      include: { agent: true, environment: true, secrets: { select: { id: true, key: true, createdAt: true } } },
    });
    res.json(configs);
  } catch (err) { next(err); }
});

configsRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const config = await prisma.agentConfig.findFirst({
      where: { id, agent: { orgId: req.user!.orgId } },
      include: { agent: true, environment: true, secrets: { select: { id: true, key: true, createdAt: true } } },
    });
    if (!config) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(config);
  } catch (err) { next(err); }
});

configsRouter.post('/', auditLog('config.upsert', 'AgentConfig'), async (req: AuthRequest, res, next) => {
  try {
    const body = upsertSchema.parse(req.body);
    const agent = await prisma.agent.findFirst({ where: { id: body.agentId, orgId: req.user!.orgId } });
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    const config = await prisma.agentConfig.upsert({
      where: { agentId_environmentId: { agentId: body.agentId, environmentId: body.environmentId } },
      create: {
        agentId: body.agentId,
        environmentId: body.environmentId,
        config: JSON.stringify(body.config),
        overrides: JSON.stringify(body.overrides),
        inheritFrom: body.inheritFrom,
      },
      update: {
        config: JSON.stringify(body.config),
        overrides: JSON.stringify(body.overrides),
        inheritFrom: body.inheritFrom,
      },
      include: { agent: true, environment: true },
    });
    res.status(201).json(config);
  } catch (err) { next(err); }
});

configsRouter.patch('/:id', auditLog('config.update', 'AgentConfig'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const body = upsertSchema.partial().parse(req.body);
    const config = await prisma.agentConfig.update({
      where: { id },
      data: {
        ...(body.config !== undefined && { config: JSON.stringify(body.config) }),
        ...(body.overrides !== undefined && { overrides: JSON.stringify(body.overrides) }),
        ...(body.inheritFrom !== undefined && { inheritFrom: body.inheritFrom }),
      },
    });
    res.json(config);
  } catch (err) { next(err); }
});

// Secrets (write-only values, keys returned only)
configsRouter.post('/:id/secrets', auditLog('config.secret.set', 'ConfigSecret'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const body = secretSchema.parse(req.body);
    const secret = await prisma.configSecret.upsert({
      where: { configId_key: { configId: id, key: body.key } },
      create: { configId: id, key: body.key, value: body.value },
      update: { value: body.value },
      select: { id: true, key: true, createdAt: true },
    });
    res.status(201).json(secret);
  } catch (err) { next(err); }
});

configsRouter.delete('/:id/secrets/:key', auditLog('config.secret.delete', 'ConfigSecret'), async (req: AuthRequest, res, next) => {
  try {
    const { id, key } = req.params;
    await prisma.configSecret.deleteMany({ where: { configId: id, key } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
