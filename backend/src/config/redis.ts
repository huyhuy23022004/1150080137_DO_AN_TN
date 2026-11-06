import Redis, { type RedisOptions } from 'ioredis';
import { logger } from './logger';
import { config } from './env';

const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  db: config.redis.db,
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 2,
  connectTimeout: 5_000,
  keepAlive: 10_000,
  retryStrategy: (times) => Math.min(times * 200, 3_000),
  ...(config.redis.password ? { password: config.redis.password } : {}),
  ...(config.redis.tls ? { tls: {} } : {}),
};

export const redis = new Redis(redisOptions);

redis.on('error', (error: unknown) => {
  logger.error({ err: error }, 'redis_error');
});

export async function connectRedis(): Promise<void> {
  if (redis.status === 'wait') {
    await redis.connect();
  }
}

export async function pingRedis(): Promise<void> {
  await connectRedis();
  await redis.ping();
}

export async function closeRedis(): Promise<void> {
  if (redis.status === 'wait' || redis.status === 'end') {
    return;
  }

  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
