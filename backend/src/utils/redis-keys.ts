import { config } from '../config/env';

export function redisKey(...parts: string[]): string {
  const suffix = parts.map((part) => String(part)).join(':');
  return `${config.redis.keyPrefix}${suffix}`;
}

export function seatLockKey(maChuyen: number | string, kyHieuGhe: string): string {
  return redisKey('seatlock', String(maChuyen), kyHieuGhe);
}

export function tripSeatLockPattern(maChuyen: number | string): string {
  return seatLockKey(maChuyen, '*');
}

export function tripSeatLockPrefix(maChuyen: number | string): string {
  return seatLockKey(maChuyen, '');
}

export function holdSessionKey(ownerRef: string): string {
  return redisKey('hold', 'session', ownerRef);
}

export function holdMetaKey(ownerRef: string): string {
  return redisKey('hold', 'meta', ownerRef);
}

export function orderSequenceKey(yymmdd: string): string {
  return redisKey('order', 'seq', yymmdd);
}

export function bookingIdempotencyKey(ownerRef: string, idempotencyKey: string): string {
  return redisKey('idem', 'booking', ownerRef, idempotencyKey);
}

export function jobLockKey(jobName: string): string {
  return redisKey('job', 'lock', jobName);
}

export function seatLayoutCacheKey(maLoaiXe: number | string): string {
  return redisKey('cache', 'seatlayout', String(maLoaiXe));
}

export function holdSessionMember(maChuyen: number | string, kyHieuGhe: string): string {
  return `${maChuyen}:${kyHieuGhe}`;
}
