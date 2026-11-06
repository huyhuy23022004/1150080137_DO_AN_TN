import type Redis from 'ioredis';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { HTTP_STATUS } from '../../common/http-status';
import { logger } from '../../config/logger';
import { redisKey } from '../../utils/redis-keys';

export type RefreshConsumeResult = 'OK' | 'MISSING' | 'REUSED';

export interface RefreshTokenStore {
  save(userId: string, jti: string, tokenHash: string, ttlSeconds: number): Promise<void>;
  consume(userId: string, jti: string, tokenHash: string): Promise<RefreshConsumeResult>;
  revoke(userId: string, jti: string): Promise<void>;
  revokeAll(userId: string): Promise<void>;
}

const CONSUME_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then
  if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then
    return -1
  end
  return 0
end
if value ~= ARGV[1] then
  return -1
end
redis.call('DEL', KEYS[1])
return 1
`;

function sessionKey(userId: string, jti: string): string {
  return redisKey('auth', 'rt', userId, jti);
}

function userSessionsKey(userId: string): string {
  return redisKey('auth', 'rt', 'user', userId);
}

function storeUnavailable(): AppError {
  return new AppError(
    HTTP_STATUS.SERVICE_UNAVAILABLE,
    ERROR_CODES.SERVICE_UNAVAILABLE,
    'Dịch vụ xác thực tạm thời không khả dụng, vui lòng thử lại sau',
  );
}

export class RedisRefreshTokenStore implements RefreshTokenStore {
  public constructor(private readonly client: Redis) {}

  public async save(
    userId: string,
    jti: string,
    tokenHash: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.run(async () => {
      const multi = this.client.multi();
      multi.set(sessionKey(userId, jti), tokenHash, 'EX', ttlSeconds);
      multi.sadd(userSessionsKey(userId), jti);
      multi.expire(userSessionsKey(userId), ttlSeconds);
      const result = await multi.exec();

      if (!result) {
        throw new Error('Redis transaction was aborted');
      }
    });
  }

  public async consume(
    userId: string,
    jti: string,
    tokenHash: string,
  ): Promise<RefreshConsumeResult> {
    return this.run(async () => {
      const result = await this.client.eval(
        CONSUME_SCRIPT,
        2,
        sessionKey(userId, jti),
        userSessionsKey(userId),
        tokenHash,
        jti,
      );

      if (result === 1) {
        return 'OK';
      }

      if (result === -1) {
        return 'REUSED';
      }

      return 'MISSING';
    });
  }

  public async revoke(userId: string, jti: string): Promise<void> {
    await this.run(async () => {
      const multi = this.client.multi();
      multi.del(sessionKey(userId, jti));
      multi.srem(userSessionsKey(userId), jti);
      const result = await multi.exec();

      if (!result) {
        throw new Error('Redis transaction was aborted');
      }
    });
  }

  public async revokeAll(userId: string): Promise<void> {
    await this.run(async () => {
      const jtis = await this.client.smembers(userSessionsKey(userId));
      const pipeline = this.client.pipeline();

      for (const jti of jtis) {
        pipeline.del(sessionKey(userId, jti));
      }

      pipeline.del(userSessionsKey(userId));
      const result = await pipeline.exec();

      if (!result) {
        throw new Error('Redis pipeline was aborted');
      }
    });
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      logger.error({ err: error }, 'refresh_token_store_unavailable');
      throw storeUnavailable();
    }
  }
}
