import type { SeatRecord } from '../vehicle-types/vehicle-types.types';

export interface SeatLockTripRecord {
  ma_chuyen: number;
  ma_loai_xe: number;
  gia_ve_co_ban: string;
  trang_thai: string;
  thoi_gian_xuat_ben: string;
}

export interface SeatCatalogPort {
  findById(id: number): Promise<SeatLockTripRecord | null>;
  findSeatLayout(vehicleTypeId: number): Promise<SeatRecord[]>;
  findBookedSeatCodes(tripId: number): Promise<Set<string>>;
}

export interface SeatLockMirrorEntry {
  ma_chuyen: number;
  ky_hieu_ghe: string;
  owner_ref: string;
  expires_at: Date;
}

export interface SeatLockMirrorPort {
  findActiveSeatCodes(tripId: number): Promise<Set<string>>;
  findActiveEntries(tripId: number): Promise<SeatLockMirrorEntry[]>;
  upsertMany(entries: SeatLockMirrorEntry[]): Promise<void>;
  deleteMany(tripId: number, seatCodes: string[]): Promise<void>;
  deleteExpired(): Promise<number>;
}

export interface AcquireResult {
  ok: true;
}

export interface AcquireConflict {
  ok: false;
  conflictKey: string;
}

export type SeatAcquireResult = AcquireResult | AcquireConflict;

export interface TripSeatLock {
  ky_hieu_ghe: string;
  owner_ref: string;
  ttl_ms: number;
}

export interface SeatLockStorePort {
  acquire(keys: string[], ownerRef: string, ttlMs: number): Promise<SeatAcquireResult>;
  release(keys: string[], ownerRef: string): Promise<number>;
  extend(keys: string[], ownerRef: string, ttlMs: number): Promise<boolean>;
  verifyAndExtend(keys: string[], ownerRef: string, ttlMs: number): Promise<boolean>;
  getOwners(keys: string[]): Promise<Array<string | null>>;
  getTripLocks(tripId: number): Promise<TripSeatLock[]>;
  addToSession(ownerRef: string, members: string[], ttlSeconds: number): Promise<void>;
  removeFromSession(ownerRef: string, members: string[]): Promise<void>;
  getSessionMembers(ownerRef: string): Promise<string[]>;
  saveMeta(ownerRef: string, meta: string, ttlSeconds: number): Promise<void>;
}

export interface HeldSeatResult {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  owner_ref: string;
  expires_at: string;
  ttl_seconds: number;
}

export interface HoldSeatRequest {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  owner_ref: string;
  socket_id?: string | null;
  ma_nguoi_dung?: string | null;
}

export interface ExtendSeatRequest {
  ma_chuyen: number;
  owner_ref: string;
}

export interface ReleaseSeatRequest {
  ma_chuyen: number;
  danh_sach_ghe?: string[];
  owner_ref: string;
  reason?: string;
}
