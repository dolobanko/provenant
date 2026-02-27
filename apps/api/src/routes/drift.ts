import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { fireWebhook } from '../lib/webhooks';

import type { IRouter } from 'express';
export const driftRouter: IRouter = Router();
driftRouter.use(authenticate);

driftRouter.get('/reports', async (req: AuthRequest, res, next) => {
  try {
    const { agentId, severity } = req.query as Record<string, string>;
    const reports = await prisma.driftReport.findMany({
      where: {
        agent: { orgId: req.user!.orgId },
        ...(agentId && { agentId }),
        ...(severity && { severity }),
      },
      include: { agent: true, agentVersion: true, environment: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reports);
  } catch (err) { next(err); }
});

driftRouter.get('/reports/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const report = await prisma.driftReport.findFirst({
      where: { id, agent: { orgId: req.user!.orgId } },
      include: { agent: true, agentVersion: true, environment: true },
    });
    if (!report) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(report);
  } catch (err) { next(err); }
});

const reportSchema = z.object({
  agentId: z.string(),
  agentVersionId: z.string().optional(),
  environmentId: z.string().optional(),
  baselineRunId: z.string().optional(),
  currentRunId: z.string().optional(),
  driftScore: z.number().min(0).max(100),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  dimensions: z.record(z.unknown()).default({}),
});

driftRouter.post('/reports', auditLog('drift.report', 'DriftReport'), async (req: AuthRequest, res, next) => {
  try {
    const body = reportSchema.parse(req.body);
    const agent = await prisma.agent.findFirst({ where: { id: body.agentId, orgId: req.user!.orgId } });
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    const report = await prisma.driftReport.create({
      data: {
        agentId: body.agentId,
        agentVersionId: body.agentVersionId,
        environmentId: body.environmentId,
        baselineRunId: body.baselineRunId,
        currentRunId: body.currentRunId,
        driftScore: body.driftScore,
        severity: body.severity,
        dimensions: JSON.stringify(body.dimensions),
      },
      include: { agent: true },
    });
    if (['HIGH', 'CRITICAL'].includes(body.severity)) {
      fireWebhook(req.user!.orgId, 'drift.detected', {
        reportId: report.id,
        agentId: body.agentId,
        agentVersionId: body.agentVersionId,
        severity: body.severity,
        driftScore: body.driftScore,
      }).catch(() => {});
    }
    res.status(201).json(report);
  } catch (err) { next(err); }
});

driftRouter.post('/reports/:id/resolve', auditLog('drift.resolve', 'DriftReport'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const report = await prisma.driftReport.update({ where: { id }, data: { resolvedAt: new Date() } });
    res.json(report);
  } catch (err) { next(err); }
});

// Baselines
const baselineSchema = z.object({
  agentId: z.string(),
  agentVersionId: z.string().optional(),
  environmentId: z.string().optional(),
  metrics: z.record(z.unknown()),
});

driftRouter.get('/baselines', async (req: AuthRequest, res, next) => {
  try {
    const { agentId } = req.query as Record<string, string>;
    const baselines = await prisma.driftBaseline.findMany({
      where: { ...(agentId && { agentId }), isActive: true },
      orderBy: { capturedAt: 'desc' },
    });
    res.json(baselines);
  } catch (err) { next(err); }
});

driftRouter.post('/baselines', auditLog('drift.baseline.create', 'DriftBaseline'), async (req: AuthRequest, res, next) => {
  try {
    const body = baselineSchema.parse(req.body);
    await prisma.driftBaseline.updateMany({
      where: { agentId: body.agentId, environmentId: body.environmentId ?? null },
      data: { isActive: false },
    });
    const baseline = await prisma.driftBaseline.create({
      data: {
        agentId: body.agentId,
        agentVersionId: body.agentVersionId,
        environmentId: body.environmentId,
        metrics: JSON.stringify(body.metrics),
      },
    });
    res.status(201).json(baseline);
  } catch (err) { next(err); }
});

// Compute drift from two eval runs
driftRouter.post('/compute', async (req: AuthRequest, res, next) => {
  try {
    const { baselineRunId, currentRunId } = z.object({
      baselineRunId: z.string(),
      currentRunId: z.string(),
    }).parse(req.body);

    const [baseline, current] = await Promise.all([
      prisma.evalRun.findUnique({ where: { id: baselineRunId }, include: { results: true } }),
      prisma.evalRun.findUnique({ where: { id: currentRunId }, include: { results: true } }),
    ]);
    if (!baseline || !current) { res.status(404).json({ error: 'Run not found' }); return; }

    const scoreDelta = Math.abs((current.score ?? 0) - (baseline.score ?? 0));
    const passRateDelta = Math.abs((current.passRate ?? 0) - (baseline.passRate ?? 0));
    const driftScore = (scoreDelta + passRateDelta * 100) / 2;

    const severity =
      driftScore > 40 ? 'CRITICAL' :
      driftScore > 25 ? 'HIGH' :
      driftScore > 10 ? 'MEDIUM' : 'LOW';

    res.json({
      driftScore,
      severity,
      dimensions: {
        scoreDelta,
        passRateDelta,
        baselineScore: baseline.score,
        currentScore: current.score,
        baselinePassRate: baseline.passRate,
        currentPassRate: current.passRate,
      },
    });
  } catch (err) { next(err); }
});
