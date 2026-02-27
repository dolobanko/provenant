import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

import type { IRouter } from 'express';
export const analyticsRouter: IRouter = Router();
analyticsRouter.use(authenticate);

analyticsRouter.get('/overview', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const [agents, sessions, evalRuns, driftReports, violations] = await Promise.all([
      prisma.agent.count({ where: { orgId } }),
      prisma.session.count({ where: { agent: { orgId } } }),
      prisma.evalRun.count({ where: { agent: { orgId } } }),
      prisma.driftReport.count({ where: { agent: { orgId } } }),
      prisma.policyViolation.count({ where: { policy: { orgId } } }),
    ]);
    res.json({ agents, sessions, evalRuns, driftReports, violations });
  } catch (err) { next(err); }
});

analyticsRouter.get('/eval-trend', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const runs = await prisma.evalRun.findMany({
      where: {
        agent: { orgId },
        createdAt: { gte: since },
        status: 'COMPLETED',
      },
      select: { createdAt: true, passRate: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDate: Record<string, { sum: number; count: number }> = {};
    for (const run of runs) {
      const date = run.createdAt.toISOString().slice(0, 10);
      if (!byDate[date]) byDate[date] = { sum: 0, count: 0 };
      byDate[date].sum += run.passRate ?? 0;
      byDate[date].count += 1;
    }

    const data = Object.entries(byDate).map(([date, { sum, count }]) => ({
      date,
      passRate: Math.round((sum / count) * 100),
    }));
    res.json(data);
  } catch (err) { next(err); }
});

analyticsRouter.get('/session-volume', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessions = await prisma.session.findMany({
      where: { agent: { orgId }, startedAt: { gte: since } },
      select: { startedAt: true },
      orderBy: { startedAt: 'asc' },
    });

    const byDate: Record<string, number> = {};
    for (const s of sessions) {
      const date = s.startedAt.toISOString().slice(0, 10);
      byDate[date] = (byDate[date] ?? 0) + 1;
    }

    const data = Object.entries(byDate).map(([date, count]) => ({ date, count }));
    res.json(data);
  } catch (err) { next(err); }
});

analyticsRouter.get('/drift-history', async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const reports = await prisma.driftReport.findMany({
      where: { agent: { orgId }, createdAt: { gte: since } },
      select: { createdAt: true, severity: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDate: Record<string, Record<string, number>> = {};
    for (const r of reports) {
      const date = r.createdAt.toISOString().slice(0, 10);
      if (!byDate[date]) byDate[date] = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
      byDate[date][r.severity] = (byDate[date][r.severity] ?? 0) + 1;
    }

    const data = Object.entries(byDate).map(([date, counts]) => ({ date, ...counts }));
    res.json(data);
  } catch (err) { next(err); }
});
