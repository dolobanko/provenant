import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { logger } from '../lib/logger';

import type { IRouter } from 'express';
export const integrationsRouter: IRouter = Router();
integrationsRouter.use(authenticate);

const createSchema = z.object({
  type: z.enum(['GITHUB', 'GITLAB', 'SLACK', 'WEBHOOK']),
  name: z.string().min(1),
  config: z.record(z.unknown()).default({}),
});

integrationsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const integrations = await prisma.integration.findMany({
      where: { orgId: req.user!.orgId },
      include: { _count: { select: { webhookEvents: true } } },
    });
    // Mask sensitive config keys (config is auto-parsed by prisma middleware)
    const safe = integrations.map((i) => ({
      ...i,
      config: Object.fromEntries(
        Object.entries((i.config as unknown) as Record<string, unknown>).map(([k, v]) =>
          k.toLowerCase().includes('secret') || k.toLowerCase().includes('token')
            ? [k, '***']
            : [k, v],
        ),
      ),
    }));
    res.json(safe);
  } catch (err) { next(err); }
});

integrationsRouter.post('/', auditLog('integration.create', 'Integration'), async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const integration = await prisma.integration.create({
      data: {
        type: body.type,
        name: body.name,
        config: JSON.stringify(body.config),
        orgId: req.user!.orgId,
      },
    });
    res.status(201).json(integration);
  } catch (err) { next(err); }
});

integrationsRouter.patch('/:id', auditLog('integration.update', 'Integration'), async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.partial().parse(req.body);
    const { id } = req.params;
    const result = await prisma.integration.updateMany({
      where: { id, orgId: req.user!.orgId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.config !== undefined && { config: JSON.stringify(body.config) }),
      },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(await prisma.integration.findUnique({ where: { id } }));
  } catch (err) { next(err); }
});

integrationsRouter.delete('/:id', auditLog('integration.delete', 'Integration'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.integration.deleteMany({ where: { id: req.params.id, orgId: req.user!.orgId } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Webhook receiver (no auth — uses integration secret for verification)
integrationsRouter.post('/webhook/:integrationId', async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { id: req.params.integrationId } });
    if (!integration || !integration.isActive) { res.status(404).json({ error: 'Not found' }); return; }

    const eventType = (req.headers['x-github-event'] ?? req.headers['x-gitlab-event'] ?? 'unknown') as string;
    const event = await prisma.webhookEvent.create({
      data: {
        integrationId: integration.id,
        eventType,
        payload: JSON.stringify(req.body),
        status: 'RECEIVED',
      },
    });

    // Process asynchronously — pass headers for agent-trace detection
    processWebhookEvent(event.id, req.headers as Record<string, string | string[] | undefined>)
      .catch((e) => logger.error('Webhook processing error', { e }));

    res.json({ received: true, eventId: event.id });
  } catch (err) { next(err); }
});

async function processWebhookEvent(eventId: string, rawHeaders?: Record<string, string | string[] | undefined>) {
  const event = await prisma.webhookEvent.findUnique({ where: { id: eventId }, include: { integration: true } });
  if (!event) return;

  await prisma.webhookEvent.update({ where: { id: eventId }, data: { status: 'PROCESSING' } });

  try {
    logger.info('Processing webhook event', { type: event.eventType, integrationId: event.integrationId });

    // ── Agent Trace ingestion ──────────────────────────────────────────────────
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(event.payload) as Record<string, unknown>; } catch { /* non-JSON */ }

    const isAgentTrace =
      rawHeaders?.['x-agent-trace'] === 'true' ||
      ('agent-trace' in payload) ||
      (typeof payload.specVersion === 'string' && typeof payload.traceId === 'string');

    if (isAgentTrace) {
      const traceData = (payload['agent-trace'] as Record<string, unknown> | undefined) ?? payload;
      const orgId = event.integration.orgId;
      await prisma.agentTrace.create({
        data: {
          orgId,
          agentVersionId: typeof traceData.agentVersionId === 'string' ? traceData.agentVersionId : null,
          specVersion: typeof traceData.specVersion === 'string' ? traceData.specVersion : '0.1.0',
          traceId: typeof traceData.traceId === 'string' ? traceData.traceId : eventId,
          vcsType: typeof traceData.vcsType === 'string' ? traceData.vcsType : null,
          vcsRevision: typeof traceData.vcsRevision === 'string' ? traceData.vcsRevision : null,
          toolName: typeof traceData.toolName === 'string' ? traceData.toolName : null,
          toolVersion: typeof traceData.toolVersion === 'string' ? traceData.toolVersion : null,
          files: Array.isArray(traceData.files) ? JSON.stringify(traceData.files) : '[]',
          metadata: typeof traceData.metadata === 'object' ? JSON.stringify(traceData.metadata) : '{}',
          source: 'WEBHOOK',
        },
      });
      logger.info('Agent trace ingested from webhook', { eventId, orgId });
    }
    // ─────────────────────────────────────────────────────────────────────────

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: 'FAILED', error: String(err) },
    });
  }
}

integrationsRouter.get('/:id/events', async (req: AuthRequest, res, next) => {
  try {
    const integration = await prisma.integration.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!integration) { res.status(404).json({ error: 'Not found' }); return; }
    const events = await prisma.webhookEvent.findMany({
      where: { integrationId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(events);
  } catch (err) { next(err); }
});
