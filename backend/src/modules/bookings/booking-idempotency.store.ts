import type Redis from 'ioredis';
import { bookingIdempotencyKey } from '../../utils/redis-keys';
import type { BookingIdempotencyStorePort } from './bookings.types';

export class RedisBookingIdempotencyStore implements BookingIdempotencyStorePort {
  public constructor(private readonly client: Redis) {}

  public async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  public async set(key: string, orderId: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, orderId, 'EX', ttlSeconds);
  }

  public async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}

export function scopedIdempotencyKey(ownerRef: string, key: string): string {
  return bookingIdempotencyKey(ownerRef, key);
}
