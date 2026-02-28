/**
 * Claude API Proxy — POST /api/proxy/messages
 *
 * Drop-in replacement for https://api.anthropic.com/v1/messages that:
 *  1. Authenticates via Provenant API key
 *  2. Creates / reuses a Provenant session
 *  3. Logs USER messages as turns
 *  4. Forwards the request to Anthropic
 *  5. Logs the ASSISTANT response turn
 *  6. Returns the Anthropic response transparently (streaming supported)
 *
 * Required headers:
 *   Authorization: Bearer <provenant-api-key>  (same as other Provenant API calls)
 *   x-anthropic-key: <user's-anthropic-api-key>
 *
 * Optional headers:
 *   x-agent-id: <provenant-agent-id>   → creates a session linked to this agent
 *   x-session-id: <provenant-session-id> → reuses an existing session
 *
 * The request body is the standard Anthropic Messages API format.
 */

import { Router, Request, Response, NextFunction } from 'express';
import https from 'https';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

import type { IRouter } from 'express';
export const proxyRouter: IRouter = Router();
proxyRouter.use(authenticate);

proxyRouter.post('/messages', async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    const anthropicKey = req.headers['x-anthropic-key'] as string | undefined;
    if (!anthropicKey) {
      res.status(400).json({ error: 'Missing x-anthropic-key header' });
      return;
    }

    const agentId = req.headers['x-agent-id'] as string | undefined;
    const existingSessionId = req.headers['x-session-id'] as string | undefined;
    const orgId = authReq.user!.orgId;

    // ── Resolve / create session ────────────────────────────────────────────
    let sessionId: string | null = null;

    if (existingSessionId) {
      const existing = await prisma.session.findFirst({
        where: { id: existingSessionId, agent: { orgId } },
      });
      if (existing) sessionId = existing.id;
    }

    if (!sessionId && agentId) {
      const agent = await prisma.agent.findFirst({ where: { id: agentId, orgId } });
      if (agent) {
        const session = await prisma.session.create({
          data: { agentId, metadata: JSON.stringify({ source: 'proxy' }) },
        });
        sessionId = session.id;
        res.setHeader('x-provenant-session-id', sessionId);
      }
    }

    // ── Log input messages as USER turns ───────────────────────────────────
    if (sessionId && req.body?.messages?.length) {
      for (const msg of req.body.messages as { role: string; content: unknown }[]) {
        if (msg.role === 'user') {
          const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);
          await prisma.sessionTurn.create({
            data: { sessionId, role: 'USER', content: content.slice(0, 100_000) },
          }).catch(() => {});
        }
      }
    }

    // ── Forward to Anthropic ────────────────────────────────────────────────
    const body = JSON.stringify(req.body);
    const isStreaming = req.body?.stream === true;

    const options: https.RequestOptions = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': anthropicKey,
        'anthropic-version': (req.headers['anthropic-version'] as string) || '2023-06-01',
      },
    };

    if (isStreaming) {
      // Streaming: pipe through directly, capture assistant text for logging
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let assistantText = '';

      const anthropicReq = https.request(options, (anthropicRes) => {
        res.status(anthropicRes.statusCode ?? 200);
        anthropicRes.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          res.write(chunk);
          // Extract text deltas for logging
          for (const line of text.split('\n')) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                  assistantText += evt.delta.text;
                }
              } catch {}
            }
          }
        });
        anthropicRes.on('end', () => {
          res.end();
          if (sessionId && assistantText) {
            prisma.sessionTurn.create({
              data: { sessionId: sessionId!, role: 'ASSISTANT', content: assistantText.slice(0, 100_000) },
            }).catch(() => {});
          }
        });
      });

      anthropicReq.on('error', (err) => {
        res.end();
        next(err);
      });

      anthropicReq.write(body);
      anthropicReq.end();
    } else {
      // Non-streaming: buffer full response
      const responseBody = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const anthropicReq = https.request(options, (anthropicRes) => {
          let buf = '';
          anthropicRes.on('data', (c: Buffer) => (buf += c.toString()));
          anthropicRes.on('end', () => resolve({ status: anthropicRes.statusCode ?? 200, body: buf }));
        });
        anthropicReq.on('error', reject);
        anthropicReq.write(body);
        anthropicReq.end();
      });

      // Log ASSISTANT turn
      if (sessionId) {
        try {
          const parsed = JSON.parse(responseBody.body);
          const assistantContent = parsed.content
            ?.map((c: { type: string; text?: string }) => c.type === 'text' ? c.text : '')
            .join('') ?? '';
          if (assistantContent) {
            await prisma.sessionTurn.create({
              data: { sessionId, role: 'ASSISTANT', content: assistantContent.slice(0, 100_000) },
            }).catch(() => {});
          }
          // Update session token counts
          if (parsed.usage) {
            await prisma.session.update({
              where: { id: sessionId },
              data: {
                totalTokens: { increment: (parsed.usage.input_tokens ?? 0) + (parsed.usage.output_tokens ?? 0) },
              },
            }).catch(() => {});
          }
        } catch {}
      }

      res.status(responseBody.status).json(JSON.parse(responseBody.body));
    }
  } catch (err) {
    next(err);
  }
});

// Convenience: end a proxy session
proxyRouter.post('/sessions/:id/end', async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, agent: { orgId: authReq.user!.orgId } },
    });
    if (!session) { res.status(404).json({ error: 'Not found' }); return; }
    const updated = await prisma.session.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });
    res.json(updated);
  } catch (err) { next(err); }
});
