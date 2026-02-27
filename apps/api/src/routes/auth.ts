import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

import type { IRouter } from 'express';
export const authRouter: IRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().min(1),
  orgSlug: z.string().min(1).regex(/^[a-z0-9-]+$/),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function signToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET ?? 'dev-secret', { expiresIn: '7d' });
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const hash = await bcrypt.hash(body.password, 12);
    const org = await prisma.org.create({
      data: { name: body.orgName, slug: body.orgSlug },
    });
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, passwordHash: hash, orgId: org.id, role: 'OWNER' },
      select: { id: true, name: true, email: true, role: true, orgId: true },
    });
    // Bootstrap dev/staging/prod environments
    await prisma.environment.createMany({
      data: [
        { orgId: org.id, name: 'Development', slug: 'development', type: 'DEVELOPMENT' },
        { orgId: org.id, name: 'Staging', slug: 'staging', type: 'STAGING', requiresApproval: true },
        { orgId: org.id, name: 'Production', slug: 'production', type: 'PRODUCTION', requiresApproval: true },
      ],
    });
    res.status(201).json({ token: signToken(user.id), user, org });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const org = await prisma.org.findUnique({ where: { id: user.orgId } });
    res.json({
      token: signToken(user.id),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId },
      org,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/accept-invitation', async (req, res, next) => {
  try {
    const body = z.object({
      token: z.string(),
      name: z.string().min(1),
      password: z.string().min(8),
    }).parse(req.body);

    const invitation = await prisma.invitation.findUnique({ where: { token: body.token } });
    if (!invitation || invitation.expiresAt < new Date() || invitation.acceptedAt) {
      res.status(400).json({ error: 'Invalid or expired invitation' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      // User already exists — move them to this org
      await prisma.user.update({
        where: { id: existing.id },
        data: { orgId: invitation.orgId, role: invitation.role },
      });
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      const org = await prisma.org.findUnique({ where: { id: invitation.orgId } });
      res.json({
        token: signToken(existing.id),
        user: { id: existing.id, name: existing.name, email: existing.email, role: invitation.role, orgId: invitation.orgId },
        org,
      });
      return;
    }

    const hash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: invitation.email,
        passwordHash: hash,
        orgId: invitation.orgId,
        role: invitation.role,
      },
      select: { id: true, name: true, email: true, role: true, orgId: true },
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    const org = await prisma.org.findUnique({ where: { id: invitation.orgId } });
    res.status(201).json({ token: signToken(user.id), user, org });
  } catch (err) { next(err); }
});

authRouter.get('/me', async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET ?? 'dev-secret') as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, role: true, orgId: true, org: true },
    });
    if (!user) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(user);
  } catch (err) {
    next(err);
  }
});
