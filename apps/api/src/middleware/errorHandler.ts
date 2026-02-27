import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Validation error', issues: err.errors });
    return;
  }
  logger.error('Unhandled error', { err, path: req.path, method: req.method });
  res.status(500).json({ error: 'Internal server error' });
}
