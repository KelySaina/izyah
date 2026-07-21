import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { asyncHandler } from '../../utils/http';

export const healthRouter = Router();

/** Liveness — cheap, always fast. */
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/** Readiness — verifies critical dependencies are reachable. */
healthRouter.get(
  '/health/ready',
  asyncHandler(async (_req, res) => {
    const [db, cache] = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);
    const checks = {
      database: db.status === 'fulfilled' ? 'ok' : 'down',
      redis: cache.status === 'fulfilled' ? 'ok' : 'down',
    };
    const ok = Object.values(checks).every((v) => v === 'ok');
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', checks });
  }),
);
