import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

import type { IRouter } from 'express';
export const auditRouter: IRouter = Router();
auditRouter.use(authenticate);

auditRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      from,
      to,
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string>;

    const where = {
      orgId: req.user!.orgId,
      ...(userId && { userId }),
      ...(action && { action: { contains: action } }),
      ...(resourceType && { resourceType }),
      ...(resourceId && { resourceId }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit), 200),
        skip: parseInt(offset),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) { next(err); }
});

auditRouter.get('/actions', async (req: AuthRequest, res, next) => {
  try {
    const actions = await prisma.auditLog.findMany({
      where: { orgId: req.user!.orgId },
      select: { action: true },
      distinct: ['action'],
    });
    res.json(actions.map((a) => a.action));
  } catch (err) { next(err); }
});

auditRouter.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const [byAction, byResourceType, byUser] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { orgId: req.user!.orgId },
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      prisma.auditLog.groupBy({
        by: ['resourceType'],
        where: { orgId: req.user!.orgId },
        _count: true,
        orderBy: { _count: { resourceType: 'desc' } },
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: { orgId: req.user!.orgId },
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 5,
      }),
    ]);
    res.json({ byAction, byResourceType, byUser });
  } catch (err) { next(err); }
});

// Export as NDJSON for compliance
auditRouter.get('/export', async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const logs = await prisma.auditLog.findMany({
      where: {
        orgId: req.user!.orgId,
        ...(from || to
          ? { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }
          : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.ndjson"');
    logs.forEach((log) => res.write(JSON.stringify(log) + '\n'));
    res.end();
  } catch (err) { next(err); }
});
