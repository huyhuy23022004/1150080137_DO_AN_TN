import { describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '../../src/common/errors/error-codes';
import { seatLockKey } from '../../src/utils/redis-keys';
import { SeatLockService } from '../../src/modules/seat-locks/seat-locks.service';
import type {
  SeatCatalogPort,
  SeatLockMirrorPort,
  SeatLockStorePort,
} from '../../src/modules/seat-locks/seat-locks.types';
import type { SeatRecord } from '../../src/modules/vehicle-types/vehicle-types.types';

const NOW = new Date('2026-10-21T08:00:00.000Z');

const LAYOUT: SeatRecord[] = [
  { ma_ghe: 1, ky_hieu_ghe: 'A1', tang: 1, hang: 1, cot: 1, loai_cho: 'THUONG' },
  { ma_ghe: 2, ky_hieu_ghe: 'A2', tang: 1, hang: 1, cot: 2, loai_cho: 'THUONG' },
];

function createHarness() {
  const store: SeatLockStorePort = {
    acquire: vi.fn(async () => ({ ok: true as const })),
    release: vi.fn(async () => 1),
    extend: vi.fn(async () => true),
    verifyAndExtend: vi.fn(async () => true),
    getOwners: vi.fn(async (keys: string[]) => keys.map(() => 'hold_owner_12345')),
    getTripLocks: vi.fn(async () => []),
    addToSession: vi.fn(async () => undefined),
    removeFromSession: vi.fn(async () => undefined),
    getSessionMembers: vi.fn(async () => []),
    saveMeta: vi.fn(async () => undefined),
  };

  const mirror: SeatLockMirrorPort = {
    findActiveSeatCodes: vi.fn(async () => new Set<string>()),
    findActiveEntries: vi.fn(async () => []),
    upsertMany: vi.fn(async () => undefined),
    deleteMany: vi.fn(async () => undefined),
    deleteExpired: vi.fn(async () => 0),
  };

  const catalog: SeatCatalogPort = {
    findById: vi.fn(async () => ({
      ma_chuyen: 10,
      ma_loai_xe: 1,
      gia_ve_co_ban: '320000.00',
      trang_thai: 'SAP_CHAY',
      thoi_gian_xuat_ben: '2026-10-21T12:00:00.000Z',
    })),
    findSeatLayout: vi.fn(async () => LAYOUT),
    findBookedSeatCodes: vi.fn(async () => new Set<string>()),
  };

  const service = new SeatLockService({
    store,
    mirror,
    catalog,
    ttlSeconds: 480,
    maxExtendSeconds: 900,
    maxSeatsPerOrder: 5,
    tripBookingCloseMinutes: 30,
    now: () => NOW,
  });

  return { service, store, mirror, catalog };
}

describe('SeatLockService', () => {
  it('giữ ghế thành công và ghi mirror', async () => {
    const harness = createHarness();

    const result = await harness.service.hold({
      ma_chuyen: 10,
      danh_sach_ghe: ['a1', 'A2', 'A1'],
      owner_ref: 'hold_owner_12345',
    });

    expect(result.danh_sach_ghe).toEqual(['A1', 'A2']);
    expect(result.ttl_seconds).toBe(480);
    expect(result.expires_at).toBe('2026-10-21T08:08:00.000Z');
    expect(harness.store.acquire).toHaveBeenCalledWith(
      [seatLockKey(10, 'A1'), seatLockKey(10, 'A2')],
      'hold_owner_12345',
      480_000,
    );
    expect(harness.mirror.upsertMany).toHaveBeenCalledTimes(1);
    expect(harness.store.saveMeta).toHaveBeenCalledTimes(1);
  });

  it('báo lỗi khi ghế đang do phiên khác giữ', async () => {
    const harness = createHarness();
    harness.store.acquire = vi.fn(async () => ({
      ok: false as const,
      conflictKey: seatLockKey(10, 'A2'),
    }));

    await expect(
      harness.service.hold({
        ma_chuyen: 10,
        danh_sach_ghe: ['A1', 'A2'],
        owner_ref: 'hold_owner_12345',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.SEAT_CONFLICT,
      details: { danh_sach_ghe: ['A2'] },
    });
  });

  it('báo lỗi khi ghế không tồn tại trong sơ đồ', async () => {
    const harness = createHarness();

    await expect(
      harness.service.hold({
        ma_chuyen: 10,
        danh_sach_ghe: ['A1', 'Z9'],
        owner_ref: 'hold_owner_12345',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.SEAT_NOT_FOUND,
      details: { danh_sach_ghe: ['Z9'] },
    });
  });

  it('báo lỗi khi giữ ghế đã bán', async () => {
    const harness = createHarness();
    harness.catalog.findBookedSeatCodes = vi.fn(async () => new Set(['A1']));

    await expect(
      harness.service.hold({
        ma_chuyen: 10,
        danh_sach_ghe: ['A1'],
        owner_ref: 'hold_owner_12345',
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.SEAT_CONFLICT });
  });

  it('từ chối đặt vé nếu lock không thuộc owner', async () => {
    const harness = createHarness();
    harness.store.verifyAndExtend = vi.fn(async () => false);
    harness.store.getOwners = vi.fn(async () => ['hold_owner_12345', 'other_owner_999']);

    await expect(
      harness.service.verifyForBooking(10, ['A1', 'A2'], 'hold_owner_12345'),
    ).rejects.toMatchObject({
      code: ERROR_CODES.SEAT_LOCK_NOT_OWNED,
      details: { danh_sach_ghe: ['A2'] },
    });
  });

  it('gộp ghế đang giữ từ Redis và bảng mirror', async () => {
    const harness = createHarness();
    harness.store.getTripLocks = vi.fn(async () => [
      { ky_hieu_ghe: 'A1', owner_ref: 'hold_owner_12345', ttl_ms: 60_000 },
    ]);
    harness.mirror.findActiveSeatCodes = vi.fn(async () => new Set(['A2']));

    const seats = await harness.service.getActiveSeatCodes(10);

    expect([...seats].sort()).toEqual(['A1', 'A2']);
  });

  it('gia hạn giữ ghế theo các ghế trong session', async () => {
    const harness = createHarness();
    harness.store.getSessionMembers = vi.fn(async () => ['10:A1', '10:A2']);

    const result = await harness.service.extend({
      ma_chuyen: 10,
      owner_ref: 'hold_owner_12345',
    });

    expect(result.danh_sach_ghe).toEqual(['A1', 'A2']);
    expect(result.ttl_seconds).toBe(900);
    expect(harness.store.extend).toHaveBeenCalledWith(
      [seatLockKey(10, 'A1'), seatLockKey(10, 'A2')],
      'hold_owner_12345',
      900_000,
    );
  });
});
