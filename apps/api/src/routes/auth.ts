import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import axios from 'axios';

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
    if (!user || !user.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
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

// ── GitHub OAuth ─────────────────────────────────────────────────────────────

authRouter.get('/github', (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID ?? '',
    redirect_uri: `${process.env.APP_URL ?? 'http://localhost:4000'}/api/auth/github/callback`,
    scope: 'read:user user:email',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

authRouter.get('/github/callback', async (req, res, next) => {
  try {
    const code = req.query.code as string;
    if (!code) { res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:5173'}/login?error=oauth_failed`); return; }

    // 1. Exchange code for access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );
    const accessToken = tokenRes.data.access_token as string;
    if (!accessToken) { res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:5173'}/login?error=oauth_failed`); return; }

    // 2. Fetch GitHub profile + primary email
    const [profileRes, emailsRes] = await Promise.all([
      axios.get('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}` } }),
      axios.get('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    const githubId = String(profileRes.data.id);
    const name: string = profileRes.data.name || profileRes.data.login;
    const primaryEmail = (emailsRes.data as Array<{ email: string; primary: boolean }>)
      .find((e) => e.primary)?.email ?? (profileRes.data.email as string | null) ?? '';
    if (!primaryEmail) { res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:5173'}/login?error=no_email`); return; }

    // 3. Find or create user
    let user = await prisma.user.findUnique({ where: { githubId }, select: { id: true, name: true, email: true, role: true, orgId: true } });

    if (!user) {
      // Check if an account with this email already exists → link GitHub to it
      const byEmail = await prisma.user.findUnique({ where: { email: primaryEmail } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { githubId },
          select: { id: true, name: true, email: true, role: true, orgId: true },
        });
      } else {
        // Brand-new user — create user + org in a transaction
        const login: string = profileRes.data.login;
        const orgSlug = `${login.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
        user = await prisma.$transaction(async (tx) => {
          const org = await tx.org.create({ data: { name: `${name}'s Org`, slug: orgSlug } });
          await tx.environment.createMany({
            data: [
              { orgId: org.id, name: 'Development', slug: 'development', type: 'DEVELOPMENT' },
              { orgId: org.id, name: 'Staging', slug: 'staging', type: 'STAGING', requiresApproval: true },
              { orgId: org.id, name: 'Production', slug: 'production', type: 'PRODUCTION', requiresApproval: true },
            ],
          });
          return tx.user.create({
            data: { name, email: primaryEmail, githubId, role: 'OWNER', orgId: org.id },
            select: { id: true, name: true, email: true, role: true, orgId: true },
          });
        });
      }
    }

    // 4. Issue JWT and redirect to frontend callback
    const token = signToken(user.id);
    const frontendUrl = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (err) {
    next(err);
  }
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
