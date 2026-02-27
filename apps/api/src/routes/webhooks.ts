import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { fireWebhook } from '../lib/webhooks';

export const webhooksRouter = Router();
webhooksRouter.use(authenticate);

const VALID_EVENTS = [
  'drift.detected',
  'eval.failed',
  'policy.violated',
  'session.ended',
  '*',
] as const;

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/webhooks — list all webhooks (omit secret)
webhooksRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { orgId: req.user!.orgId },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // omit secret intentionally
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { statusCode: true, createdAt: true, durationMs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(webhooks);
  } catch (err) {
    next(err);
  }
});

// POST /api/webhooks — create
webhooksRouter.post(
  '/',
  auditLog('webhook.create', 'Webhook'),
  async (req: AuthRequest, res, next) => {
    try {
      const body = createSchema.parse(req.body);
      const secret = crypto.randomBytes(24).toString('hex');

      const webhook = await prisma.webhook.create({
        data: {
          orgId: req.user!.orgId,
          name: body.name,
          url: body.url,
          events: JSON.stringify(body.events),
          secret,
        },
      });

      // Return including secret (only time it's shown)
      res.status(201).json({ ...webhook, secret });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/webhooks/:id — update
webhooksRouter.patch(
  '/:id',
  auditLog('webhook.update', 'Webhook'),
  async (req: AuthRequest, res, next) => {
    try {
      const body = updateSchema.parse(req.body);

      const existing = await prisma.webhook.findFirst({
        where: { id: req.params.id, orgId: req.user!.orgId },
      });
      if (!existing) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      const updated = await prisma.webhook.update({
        where: { id: req.params.id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.url !== undefined && { url: body.url }),
          ...(body.events !== undefined && { events: JSON.stringify(body.events) }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: {
          id: true, name: true, url: true, events: true, isActive: true,
          createdAt: true, updatedAt: true,
        },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/webhooks/:id
webhooksRouter.delete(
  '/:id',
  auditLog('webhook.delete', 'Webhook'),
  async (req: AuthRequest, res, next) => {
    try {
      const existing = await prisma.webhook.findFirst({
        where: { id: req.params.id, orgId: req.user!.orgId },
      });
      if (!existing) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      await prisma.webhook.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/webhooks/:id/deliveries — delivery history
webhooksRouter.get('/:id/deliveries', async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.webhook.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, event: true, statusCode: true, durationMs: true,
        response: true, createdAt: true,
      },
    });

    res.json(deliveries);
  } catch (err) {
    next(err);
  }
});

// POST /api/webhooks/:id/test — send test event
webhooksRouter.post('/:id/test', async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.webhook.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    const testPayload = JSON.stringify({
      event: 'provenant.test',
      timestamp: new Date().toISOString(),
      orgId: req.user!.orgId,
      data: { message: 'This is a test delivery from Provenant.' },
    });

    const sig = `sha256=${crypto.createHmac('sha256', existing.secret as string).update(testPayload).digest('hex')}`;

    const start = Date.now();
    try {
      const r = await fetch(existing.url as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Provenant-Signature': sig,
          'X-Provenant-Event': 'provenant.test',
          'User-Agent': 'Provenant-Webhooks/1.0',
        },
        body: testPayload,
        signal: AbortSignal.timeout(10_000),
      });
      const durationMs = Date.now() - start;
      const responseText = await r.text().catch(() => '');

      // Record delivery
      prisma.webhookDelivery.create({
        data: {
          webhookId: existing.id,
          event: 'provenant.test',
          payload: testPayload,
          statusCode: r.status,
          response: responseText.slice(0, 500),
          durationMs,
        },
      }).catch(() => {});

      res.json({ statusCode: r.status, durationMs, success: r.ok });
    } catch (fetchErr) {
      const durationMs = Date.now() - start;
      prisma.webhookDelivery.create({
        data: {
          webhookId: existing.id,
          event: 'provenant.test',
          payload: testPayload,
          durationMs,
        },
      }).catch(() => {});
      res.json({ statusCode: null, durationMs, success: false, error: String(fetchErr) });
    }
  } catch (err) {
    next(err);
  }
});
