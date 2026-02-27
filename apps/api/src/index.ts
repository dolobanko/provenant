import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth';
import { agentsRouter } from './routes/agents';
import { environmentsRouter } from './routes/environments';
import { configsRouter } from './routes/configs';
import { evalsRouter } from './routes/evals';
import { driftRouter } from './routes/drift';
import { sessionsRouter } from './routes/sessions';
import { integrationsRouter } from './routes/integrations';
import { policiesRouter } from './routes/policies';
import { auditRouter } from './routes/audit';
import { orgRouter } from './routes/org';
import { analyticsRouter } from './routes/analytics';
import { webhooksRouter } from './routes/webhooks';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/environments', environmentsRouter);
app.use('/api/configs', configsRouter);
app.use('/api/evals', evalsRouter);
app.use('/api/drift', driftRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/policies', policiesRouter);
app.use('/api/audit', auditRouter);
app.use('/api/org', orgRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/webhooks', webhooksRouter);

app.use(errorHandler);

async function main() {
  try {
    await prisma.$connect();
    logger.info('Database connected');
    app.listen(PORT, () => logger.info(`API running on http://localhost:${PORT}`));
  } catch (err) {
    logger.error('Failed to start server', { err });
    process.exit(1);
  }
}

main();
