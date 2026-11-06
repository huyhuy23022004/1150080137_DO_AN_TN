import type Redis from 'ioredis';
import {
  holdMetaKey,
  holdSessionKey,
  tripSeatLockPattern,
  tripSeatLockPrefix,
} from '../../utils/redis-keys';
import type { SeatAcquireResult, SeatLockStorePort, TripSeatLock } from './seat-locks.types';

const ACQUIRE_SCRIPT = `
-- KEYS: seat lock keys; ARGV[1]: owner_ref; ARGV[2]: ttl_ms
local n = #KEYS
for i = 1, n do
  local owner = redis.call('GET', KEYS[i])
  if owner and owner ~= ARGV[1] then
    return {0, i}
  end
end
for i = 1, n do
  redis.call('SET', KEYS[i], ARGV[1], 'PX', ARGV[2])
end
return {1, 0}
`;

const RELEASE_SCRIPT = `
-- KEYS: seat lock keys; ARGV[1]: owner_ref
local released = 0
for i = 1, #KEYS do
  if redis.call('GET', KEYS[i]) == ARGV[1] then
    released = released + redis.call('DEL', KEYS[i])
  end
end
return released
`;

const EXTEND_SCRIPT = `
-- KEYS: seat lock keys; ARGV[1]: owner_ref; ARGV[2]: ttl_ms
for i = 1, #KEYS do
  if redis.call('GET', KEYS[i]) ~= ARGV[1] then
    return 0
  end
end
for i = 1, #KEYS do
  redis.call('PEXPIRE', KEYS[i], ARGV[2])
end
return 1
`;

const VERIFY_EXTEND_SCRIPT = `
-- KEYS: seat lock keys; ARGV[1]: owner_ref; ARGV[2]: ttl_ms
for i = 1, #KEYS do
  local owner = redis.call('GET', KEYS[i])
  if not owner or owner ~= ARGV[1] then
    return 0
  end
end
for i = 1, #KEYS do
  redis.call('PEXPIRE', KEYS[i], ARGV[2])
end
return 1
`;

function parseAcquireResult(raw: unknown, keys: string[]): SeatAcquireResult {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error('Unexpected Redis seat lock response');
  }

  const success = Number(raw[0]);
  if (success === 1) {
    return { ok: true };
  }

  const index = Number(raw[1]);
  const conflictKey = keys[index - 1];
  if (!conflictKey) {
    throw new Error('Redis seat lock conflict index is invalid');
  }

  return { ok: false, conflictKey };
}

export class RedisSeatLockStore implements SeatLockStorePort {
  public constructor(private readonly client: Redis) {}

  public async acquire(
    keys: string[],
    ownerRef: string,
    ttlMs: number,
  ): Promise<SeatAcquireResult> {
    if (keys.length === 0) {
      return { ok: true };
    }

    const raw = await this.client.eval(ACQUIRE_SCRIPT, keys.length, ...keys, ownerRef, ttlMs);
    return parseAcquireResult(raw, keys);
  }

  public async release(keys: string[], ownerRef: string): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const raw = await this.client.eval(RELEASE_SCRIPT, keys.length, ...keys, ownerRef);
    return Number(raw);
  }

  public async extend(keys: string[], ownerRef: string, ttlMs: number): Promise<boolean> {
    if (keys.length === 0) {
      return false;
    }

    const raw = await this.client.eval(EXTEND_SCRIPT, keys.length, ...keys, ownerRef, ttlMs);
    return Number(raw) === 1;
  }

  public async verifyAndExtend(keys: string[], ownerRef: string, ttlMs: number): Promise<boolean> {
    if (keys.length === 0) {
      return false;
    }

    const raw = await this.client.eval(VERIFY_EXTEND_SCRIPT, keys.length, ...keys, ownerRef, ttlMs);
    return Number(raw) === 1;
  }

  public async getOwners(keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) {
      return [];
    }

    return this.client.mget(...keys);
  }

  public async getTripLocks(tripId: number): Promise<TripSeatLock[]> {
    const pattern = tripSeatLockPattern(tripId);
    const prefix = tripSeatLockPrefix(tripId);
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    const locks = await Promise.all(
      keys.map(async (key) => {
        const [owner, ttl] = await Promise.all([this.client.get(key), this.client.pttl(key)]);
        if (!owner || ttl <= 0) {
          return null;
        }

        return {
          ky_hieu_ghe: key.slice(prefix.length),
          owner_ref: owner,
          ttl_ms: ttl,
        };
      }),
    );

    return locks.filter((lock): lock is TripSeatLock => lock !== null);
  }

  public async addToSession(
    ownerRef: string,
    members: string[],
    ttlSeconds: number,
  ): Promise<void> {
    if (members.length === 0) {
      return;
    }

    const key = holdSessionKey(ownerRef);
    await this.client.sadd(key, ...members);
    await this.client.expire(key, ttlSeconds);
  }

  public async removeFromSession(ownerRef: string, members: string[]): Promise<void> {
    if (members.length === 0) {
      return;
    }

    const key = holdSessionKey(ownerRef);
    await this.client.srem(key, ...members);
    const remaining = await this.client.scard(key);
    if (remaining === 0) {
      await this.client.del(key);
    }
  }

  public async getSessionMembers(ownerRef: string): Promise<string[]> {
    return this.client.smembers(holdSessionKey(ownerRef));
  }

  public async saveMeta(ownerRef: string, meta: string, ttlSeconds: number): Promise<void> {
    await this.client.set(holdMetaKey(ownerRef), meta, 'EX', ttlSeconds);
  }
}
