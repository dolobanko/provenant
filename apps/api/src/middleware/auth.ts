import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; orgId: string; role: string; email: string };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = header.slice(7);

  // API Key path: token starts with pk_live_
  if (token.startsWith('pk_live_')) {
    try {
      const randomPart = token.slice(8); // strip "pk_live_"
      const keyPrefix = randomPart.slice(0, 8);
      const keyHash = crypto.createHash('sha256').update(token).digest('hex');

      const apiKey = await prisma.apiKey.findFirst({
        where: { keyPrefix, keyHash, isActive: true },
        include: { user: true },
      });

      if (!apiKey || (apiKey.expiresAt && apiKey.expiresAt < new Date())) {
        res.status(401).json({ error: 'Invalid or expired API key' });
        return;
      }

      // Update lastUsedAt fire-and-forget
      prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      req.user = {
        id: apiKey.user.id,
        orgId: apiKey.user.orgId,
        role: apiKey.user.role,
        email: apiKey.user.email,
      };
      next();
    } catch {
      res.status(401).json({ error: 'Invalid API key' });
    }
    return;
  }

  // JWT path
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as {
      userId: string;
    };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    req.user = { id: user.id, orgId: user.orgId, role: user.role, email: user.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
