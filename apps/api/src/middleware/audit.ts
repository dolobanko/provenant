import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from './auth';

export function auditLog(action: string, resourceType: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (res.statusCode < 400 && req.user) {
        const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const bodyId = (body as Record<string, string>)?.id;
        prisma.auditLog
          .create({
            data: {
              orgId: req.user.orgId,
              userId: req.user.id,
              action,
              resourceType,
              resourceId: (paramId ?? bodyId) || undefined,
              before: req.method !== 'POST' ? JSON.stringify(req.body) : undefined,
              after: JSON.stringify(body),
              ipAddress: req.ip,
              userAgent: Array.isArray(req.headers['user-agent'])
                ? req.headers['user-agent'][0]
                : req.headers['user-agent'],
            },
          })
          .catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}
