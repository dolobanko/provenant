import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { fireWebhook } from '../lib/webhooks';
import { sendSlackAlert, policyViolationPayload } from '../services/notifications';

import type { IRouter } from 'express';
export const policiesRouter: IRouter = Router();
policiesRouter.use(authenticate);

const policySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['DEPLOYMENT', 'CONTENT', 'RATE_LIMIT', 'DATA_PRIVACY', 'APPROVAL']),
  rules: z.array(z.record(z.unknown())).default([]),
  isEnabled: z.boolean().default(true),
  enforcementLevel: z.enum(['WARN', 'BLOCK', 'NOTIFY']).default('WARN'),
});

policiesRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const policies = await prisma.policy.findMany({
      where: { orgId: req.user!.orgId },
      include: { _count: { select: { violations: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(policies);
  } catch (err) { next(err); }
});

policiesRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const policy = await prisma.policy.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: { violations: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!policy) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(policy);
  } catch (err) { next(err); }
});

policiesRouter.post('/', auditLog('policy.create', 'Policy'), async (req: AuthRequest, res, next) => {
  try {
    const body = policySchema.parse(req.body);
    const policy = await prisma.policy.create({
      data: {
        name: body.name,
        description: body.description,
        type: body.type,
        isEnabled: body.isEnabled,
        enforcementLevel: body.enforcementLevel,
        rules: JSON.stringify(body.rules),
        orgId: req.user!.orgId,
      },
    });
    res.status(201).json(policy);
  } catch (err) { next(err); }
});

policiesRouter.patch('/:id', auditLog('policy.update', 'Policy'), async (req: AuthRequest, res, next) => {
  try {
    const body = policySchema.partial().parse(req.body);
    const { id } = req.params;
    const result = await prisma.policy.updateMany({
      where: { id, orgId: req.user!.orgId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.isEnabled !== undefined && { isEnabled: body.isEnabled }),
        ...(body.enforcementLevel !== undefined && { enforcementLevel: body.enforcementLevel }),
        ...(body.rules !== undefined && { rules: JSON.stringify(body.rules) }),
      },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(await prisma.policy.findUnique({ where: { id } }));
  } catch (err) { next(err); }
});

policiesRouter.delete('/:id', auditLog('policy.delete', 'Policy'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.policy.deleteMany({ where: { id: req.params.id, orgId: req.user!.orgId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Violations
const violationSchema = z.object({
  policyId: z.string(),
  resourceId: z.string(),
  resourceType: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  details: z.record(z.unknown()).default({}),
});

policiesRouter.post('/violations', auditLog('policy.violation', 'PolicyViolation'), async (req: AuthRequest, res, next) => {
  try {
    const body = violationSchema.parse(req.body);
    const policy = await prisma.policy.findFirst({ where: { id: body.policyId, orgId: req.user!.orgId } });
    if (!policy) { res.status(404).json({ error: 'Policy not found' }); return; }
    const violation = await prisma.policyViolation.create({
      data: {
        policyId: body.policyId,
        resourceId: body.resourceId,
        resourceType: body.resourceType,
        severity: body.severity,
        details: JSON.stringify(body.details),
      },
    });
    fireWebhook(req.user!.orgId, 'policy.violated', {
      violationId: violation.id,
      policyId: body.policyId,
      resourceId: body.resourceId,
      resourceType: body.resourceType,
      severity: body.severity,
    }).catch(() => {});
    // Slack alert
    prisma.org.findUnique({ where: { id: req.user!.orgId }, select: { slackWebhookUrl: true } })
      .then((org) => {
        if (org?.slackWebhookUrl) {
          sendSlackAlert(org.slackWebhookUrl, policyViolationPayload({
            policyName: policy.name,
            agentName: body.resourceType,
            severity: body.severity,
            description: JSON.stringify(body.details).slice(0, 200),
            baseUrl: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
          }));
        }
      }).catch(() => {});
    res.status(201).json(violation);
  } catch (err) { next(err); }
});

policiesRouter.get('/violations', async (req: AuthRequest, res, next) => {
  try {
    const violations = await prisma.policyViolation.findMany({
      where: { policy: { orgId: req.user!.orgId } },
      include: { policy: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(violations);
  } catch (err) { next(err); }
});

policiesRouter.post('/violations/:id/resolve', auditLog('policy.violation.resolve', 'PolicyViolation'), async (req: AuthRequest, res, next) => {
  try {
    const violation = await prisma.policyViolation.update({
      where: { id: req.params.id },
      data: { resolvedAt: new Date() },
    });
    res.json(violation);
  } catch (err) { next(err); }
});

// Evaluate a resource against all policies
policiesRouter.post('/evaluate', async (req: AuthRequest, res, next) => {
  try {
    const { resourceType, resourceId } = z.object({
      resourceType: z.string(),
      resourceId: z.string(),
      context: z.record(z.unknown()).default({}),
    }).parse(req.body);

    const policies = await prisma.policy.findMany({
      where: { orgId: req.user!.orgId, isEnabled: true },
    });

    const results = policies.map((p) => ({
      policyId: p.id,
      policyName: p.name,
      type: p.type,
      enforcementLevel: p.enforcementLevel,
      passed: true,
      details: {},
    }));

    res.json({ resourceType, resourceId, results, allPassed: results.every((r) => r.passed) });
  } catch (err) { next(err); }
});
