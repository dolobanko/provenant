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

// ─── Baselines ─────────────────────────────────────────────────────────────

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

// ─── Compute drift from two eval runs ──────────────────────────────────────

driftRouter.post('/compute', auditLog('drift.compute', 'DriftReport'), async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      baselineRunId: z.string(),
      currentRunId: z.string(),
      agentId: z.string().optional(),
      agentVersionId: z.string().optional(),
      environmentId: z.string().optional(),
    }).parse(req.body);

    const { baselineRunId, currentRunId } = body;

    const [baselineRun, currentRun] = await Promise.all([
      prisma.evalRun.findUnique({ where: { id: baselineRunId }, include: { results: true } }),
      prisma.evalRun.findUnique({ where: { id: currentRunId }, include: { results: true } }),
    ]);

    if (!baselineRun || !currentRun) {
      res.status(404).json({ error: 'Eval run not found' });
      return;
    }

    // Verify the agent belongs to the requesting org
    const agentId = body.agentId ?? currentRun.agentId;
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, orgId: req.user!.orgId },
    });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found or access denied' });
      return;
    }

    const baselinePassRate = baselineRun.passRate ?? 0;
    const currentPassRate = currentRun.passRate ?? 0;
    const baselineScore = baselineRun.score ?? 0;
    const currentScore = currentRun.score ?? 0;

    // Drift score = percentage deviation of passRate from baseline (0–100 scale)
    // 0 drift = identical passRate, 100 = complete inversion
    const passRateDelta = baselinePassRate - currentPassRate; // positive = degradation
    const scoreDelta = baselineScore - currentScore;

    // Weight passRate deviation heavily (it's the primary signal)
    const driftScore = Math.min(100, Math.round(Math.abs(passRateDelta) * 100));

    // Severity thresholds as specified:
    // LOW < 10, MEDIUM < 25, HIGH < 50, CRITICAL >= 50
    const severity =
      driftScore >= 50 ? 'CRITICAL' :
      driftScore >= 25 ? 'HIGH' :
      driftScore >= 10 ? 'MEDIUM' : 'LOW';

    const dimensions = {
      passRateDelta: Math.round(passRateDelta * 1000) / 1000,
      scoreDelta: Math.round(scoreDelta * 10) / 10,
      baselinePassRate: Math.round(baselinePassRate * 1000) / 1000,
      currentPassRate: Math.round(currentPassRate * 1000) / 1000,
      baselineScore: Math.round(baselineScore * 10) / 10,
      currentScore: Math.round(currentScore * 10) / 10,
      baselineCaseCount: baselineRun.results.length,
      currentCaseCount: currentRun.results.length,
    };

    // Save DriftReport
    const report = await prisma.driftReport.create({
      data: {
        agentId,
        agentVersionId: body.agentVersionId ?? currentRun.agentVersionId ?? undefined,
        environmentId: body.environmentId ?? currentRun.environmentId ?? undefined,
        baselineRunId,
        currentRunId,
        driftScore,
        severity,
        dimensions: JSON.stringify(dimensions),
      },
      include: { agent: true, agentVersion: true, environment: true },
    });

    // Save / update DriftBaseline with current run's metrics if there isn't one yet
    const existingBaseline = await prisma.driftBaseline.findFirst({
      where: { agentId, isActive: true },
    });

    if (!existingBaseline) {
      await prisma.driftBaseline.create({
        data: {
          agentId,
          agentVersionId: body.agentVersionId ?? baselineRun.agentVersionId ?? undefined,
          environmentId: body.environmentId ?? baselineRun.environmentId ?? undefined,
          metrics: JSON.stringify({
            passRate: baselinePassRate,
            score: baselineScore,
            caseCount: baselineRun.results.length,
            runId: baselineRunId,
          }),
        },
      });
    }

    // Fire webhook for HIGH or CRITICAL severity
    if (['HIGH', 'CRITICAL'].includes(severity)) {
      fireWebhook(req.user!.orgId, 'drift.detected', {
        reportId: report.id,
        agentId,
        agentVersionId: report.agentVersionId,
        severity,
        driftScore,
        dimensions,
      }).catch(() => {});
    }

    res.status(201).json(report);
  } catch (err) { next(err); }
});
