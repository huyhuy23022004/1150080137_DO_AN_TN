import { Router } from 'express';
import { pingDatabase } from '../config/database';
import { pingRedis } from '../config/redis';
import { HTTP_STATUS } from '../common/http-status';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Health check timed out'));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/livez', (_req, res) => {
    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/healthz', async (_req, res) => {
    const [database, redis] = await Promise.allSettled([
      withTimeout(pingDatabase(), 2_000),
      withTimeout(pingRedis(), 2_000),
    ]);

    const databaseOk = database.status === 'fulfilled';
    const redisOk = redis.status === 'fulfilled';
    const healthy = databaseOk && redisOk;

    res.status(healthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      status: healthy ? 'ok' : 'degraded',
      dependencies: {
        database: databaseOk ? 'up' : 'down',
        redis: redisOk ? 'up' : 'down',
      },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
