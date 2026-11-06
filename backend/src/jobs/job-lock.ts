import type Redis from 'ioredis';
import { logger } from '../config/logger';
import { jobLockKey } from '../utils/redis-keys';

export interface JobLockPort {
  tryAcquire(name: string, ttlMs: number): Promise<boolean>;
}

export class RedisJobLock implements JobLockPort {
  public constructor(private readonly client: Redis) {}

  public async tryAcquire(name: string, ttlMs: number): Promise<boolean> {
    try {
      const result = await this.client.set(jobLockKey(name), '1', 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.warn({ err: error, job: name }, 'job_lock_unavailable_running_degraded');
      return true;
    }
  }
}
