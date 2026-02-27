import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

import type { IRouter } from 'express';
export const orgRouter: IRouter = Router();
orgRouter.use(authenticate);

// ─── API Keys ─────────────────────────────────────────────────────────────────

orgRouter.get('/keys', async (req: AuthRequest, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { orgId: req.user!.orgId, isActive: true },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(keys);
  } catch (err) { next(err); }
});

orgRouter.post('/keys', auditLog('apikey.create', 'ApiKey'), async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      expiresAt: z.string().optional(),
    }).parse(req.body);

    const randomHex = crypto.randomBytes(16).toString('hex');
    const fullKey = `pk_live_${randomHex}`;
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    const keyPrefix = randomHex.slice(0, 8);

    const apiKey = await prisma.apiKey.create({
      data: {
        orgId: req.user!.orgId,
        userId: req.user!.id,
        name: body.name,
        keyHash,
        keyPrefix,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    res.status(201).json({ ...apiKey, key: fullKey });
  } catch (err) { next(err); }
});

orgRouter.delete('/keys/:id', auditLog('apikey.delete', 'ApiKey'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.apiKey.updateMany({
      where: { id: req.params.id, orgId: req.user!.orgId },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Team Members ─────────────────────────────────────────────────────────────

orgRouter.get('/members', async (req: AuthRequest, res, next) => {
  try {
    const members = await prisma.user.findMany({
      where: { orgId: req.user!.orgId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch (err) { next(err); }
});

orgRouter.patch('/members/:userId/role',
  requireRole('OWNER'),
  auditLog('member.role.update', 'User'),
  async (req: AuthRequest, res, next) => {
    try {
      const { userId } = req.params;
      const { role } = z.object({
        role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
      }).parse(req.body);

      const updated = await prisma.user.updateMany({
        where: { id: userId, orgId: req.user!.orgId },
        data: { role },
      });
      if (updated.count === 0) { res.status(404).json({ error: 'Member not found' }); return; }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
      });
      res.json(user);
    } catch (err) { next(err); }
  }
);

orgRouter.delete('/members/:userId',
  requireRole('OWNER', 'ADMIN'),
  auditLog('member.remove', 'User'),
  async (req: AuthRequest, res, next) => {
    try {
      const { userId } = req.params;
      if (userId === req.user!.id) {
        res.status(400).json({ error: 'Cannot remove yourself' });
        return;
      }
      await prisma.user.deleteMany({ where: { id: userId, orgId: req.user!.orgId } });
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

// ─── Invitations ──────────────────────────────────────────────────────────────

orgRouter.get('/invitations', async (req: AuthRequest, res, next) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: { orgId: req.user!.orgId, acceptedAt: null },
      include: { invitedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invitations);
  } catch (err) { next(err); }
});

orgRouter.post('/invitations',
  auditLog('invitation.create', 'Invitation'),
  async (req: AuthRequest, res, next) => {
    try {
      const body = z.object({
        email: z.string().email(),
        role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
      }).parse(req.body);

      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invitation = await prisma.invitation.create({
        data: {
          orgId: req.user!.orgId,
          email: body.email,
          role: body.role,
          token,
          expiresAt,
          invitedById: req.user!.id,
        },
        include: { invitedBy: { select: { name: true, email: true } } },
      });

      const inviteLink = `${process.env.APP_URL ?? 'http://localhost:5173'}/accept-invitation?token=${token}`;
      res.status(201).json({ ...invitation, inviteLink });
    } catch (err) { next(err); }
  }
);

orgRouter.delete('/invitations/:id',
  auditLog('invitation.cancel', 'Invitation'),
  async (req: AuthRequest, res, next) => {
    try {
      await prisma.invitation.deleteMany({
        where: { id: req.params.id, orgId: req.user!.orgId },
      });
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);
