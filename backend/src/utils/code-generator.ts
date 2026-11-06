import type Redis from 'ioredis';
import { orderSequenceKey } from './redis-keys';

const ORDER_SEQUENCE_TTL_SECONDS = 2 * 86_400;

export interface OrderCodeGeneratorPort {
  next(now: Date): Promise<string>;
}

function yymmddInVietnam(now: Date): string {
  const vietnam = new Date(now.getTime() + 7 * 3_600_000);
  const year = String(vietnam.getUTCFullYear()).slice(-2);
  const month = String(vietnam.getUTCMonth() + 1).padStart(2, '0');
  const day = String(vietnam.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function buildOrderCode(now: Date, sequence: number): string {
  return `FUTA${yymmddInVietnam(now)}${String(sequence).padStart(6, '0')}`;
}

export class RedisOrderCodeGenerator implements OrderCodeGeneratorPort {
  public constructor(private readonly client: Redis) {}

  public async next(now: Date): Promise<string> {
    const key = orderSequenceKey(yymmddInVietnam(now));
    const sequence = await this.client.incr(key);

    if (sequence === 1) {
      await this.client.expire(key, ORDER_SEQUENCE_TTL_SECONDS);
    }

    return buildOrderCode(now, sequence);
  }
}
