import crypto from 'crypto';
import { prisma } from './prisma';
import { logger } from './logger';

function buildSlackBlocks(event: string, data: object) {
  const icon = event.startsWith('drift') ? '🔴' : event.startsWith('eval') ? '🧪' : event.startsWith('policy') ? '🛡️' : '📡';
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${icon} Provenant — ${event}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '```' + JSON.stringify(data, null, 2).slice(0, 2500) + '```',
      },
    },
  ];
}

export async function fireWebhook(orgId: string, event: string, data: object): Promise<void> {
  let webhooks: Array<{ id: string; url: string; events: unknown; secret: string }>;

  try {
    webhooks = await prisma.webhook.findMany({
      where: { orgId, isActive: true },
      select: { id: true, url: true, events: true, secret: true },
    });
  } catch (err) {
    logger.warn('fireWebhook: failed to query webhooks', { orgId, event, err: String(err) });
    return;
  }

  for (const wh of webhooks) {
    const events = (wh.events as unknown) as string[];
    if (!Array.isArray(events)) continue;
    if (!events.includes(event) && !events.includes('*')) continue;

    const standardPayload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      orgId,
      data,
    });

    const sig = `sha256=${crypto.createHmac('sha256', wh.secret).update(standardPayload).digest('hex')}`;

    const isSlack = wh.url.includes('hooks.slack.com');
    const bodyToSend = isSlack
      ? JSON.stringify({ text: `*Provenant — ${event}*`, blocks: buildSlackBlocks(event, data) })
      : standardPayload;

    const start = Date.now();

    fetch(wh.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Provenant-Signature': sig,
        'X-Provenant-Event': event,
        'User-Agent': 'Provenant-Webhooks/1.0',
      },
      body: bodyToSend,
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (r) => {
        const durationMs = Date.now() - start;
        const responseText = await r.text().catch(() => '');
        prisma.webhookDelivery
          .create({
            data: {
              webhookId: wh.id,
              event,
              payload: standardPayload,
              statusCode: r.status,
              response: responseText.slice(0, 500),
              durationMs,
            },
          })
          .catch(() => {});
      })
      .catch((err) => {
        const durationMs = Date.now() - start;
        logger.warn('Webhook delivery failed', { webhookId: wh.id, event, err: String(err) });
        prisma.webhookDelivery
          .create({
            data: {
              webhookId: wh.id,
              event,
              payload: standardPayload,
              durationMs,
            },
          })
          .catch(() => {});
      });
  }
}
