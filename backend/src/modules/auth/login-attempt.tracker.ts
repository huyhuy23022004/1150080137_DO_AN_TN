import type Redis from 'ioredis';
import { logger } from '../../config/logger';
import { redisKey } from '../../utils/redis-keys';

export interface LoginAttemptTracker {
  isLocked(phone: string): Promise<boolean>;
  recordFailure(phone: string): Promise<number>;
  reset(phone: string): Promise<void>;
}

function attemptKey(phone: string): string {
  return redisKey('auth', 'fail', phone);
}

export class RedisLoginAttemptTracker implements LoginAttemptTracker {
  public constructor(
    private readonly client: Redis,
    private readonly maxAttempts: number,
    private readonly lockSeconds: number,
  ) {}

  public async isLocked(phone: string): Promise<boolean> {
    try {
      const value = await this.client.get(attemptKey(phone));
      return value !== null && Number(value) >= this.maxAttempts;
    } catch (error) {
      logger.warn({ err: error }, 'login_attempt_tracker_read_failed');
      return false;
    }
  }

  public async recordFailure(phone: string): Promise<number> {
    try {
      const key = attemptKey(phone);
      const count = await this.client.incr(key);

      if (count === 1) {
        await this.client.expire(key, this.lockSeconds);
      } else {
        const ttl = await this.client.ttl(key);
        if (ttl < 0) {
          await this.client.expire(key, this.lockSeconds);
        }
      }

      return count;
    } catch (error) {
      logger.warn({ err: error }, 'login_attempt_tracker_write_failed');
      return 0;
    }
  }

  public async reset(phone: string): Promise<void> {
    try {
      await this.client.del(attemptKey(phone));
    } catch (error) {
      logger.warn({ err: error }, 'login_attempt_tracker_reset_failed');
    }
  }
}
