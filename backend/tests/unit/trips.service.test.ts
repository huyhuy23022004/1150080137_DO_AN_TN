import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TripService } from '../../src/modules/trips/trips.service';
import type { TripRecord, TripRepositoryPort } from '../../src/modules/trips/trips.types';
import type { SeatRecord } from '../../src/modules/vehicle-types/vehicle-types.types';

vi.mock('../../src/db/transaction', () => ({
  withTransaction: async <T>(work: (connection: object) => Promise<T>): Promise<T> => work({}),
}));

function baseTrip(overrides: Partial<TripRecord> = {}): TripRecord {
  return {
    ma_chuyen: 10,
    ma_tuyen: 1,
    ten_tuyen: 'Sài Gòn - Đà Lạt',
    tinh_di: 'TP. Hồ Chí Minh',
    tinh_den: 'Lâm Đồng',
    ma_xe: 1,
    bien_so_xe: '51B-289.45',
    ma_loai_xe: 1,
    ten_loai_xe: 'Limousine 34 Phòng',
    tong_so_ghe: 34,
    ma_tai_xe: '3',
    ten_tai_xe: 'Nguyễn Văn Tài',
    so_dien_thoai_tai_xe: '0901000001',
    ma_chi_nhanh_tai_xe: 1,
    thoi_gian_xuat_ben: '2026-10-22T01:00:00.000Z',
    thoi_gian_den_du_kien: '2026-10-22T07:30:00.000Z',
    gia_ve_co_ban: '320000.00',
    trang_thai: 'SAP_CHAY',
    so_ghe_da_dat: 0,
    so_ghe_dang_giu: 0,
    so_ghe_trong: 34,
    ...overrides,
  };
}

function createRepository(overrides: Partial<TripRepositoryPort> = {}): TripRepositoryPort {
  const repository: TripRepositoryPort = {
    search: vi.fn(async () => ({ items: [], total: 0 })),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    findById: vi.fn(async () => baseTrip()),
    lockTripRow: vi.fn(async () => baseTrip()),
    findRouteById: vi.fn(async () => null),
    findVehicleById: vi.fn(async () => null),
    findDriverById: vi.fn(async () => null),
    lockRoute: vi.fn(async () => ({
      ma_tuyen: 1,
      ten_tuyen: 'Sài Gòn - Đà Lạt',
      tinh_di: 'TP. Hồ Chí Minh',
      tinh_den: 'Lâm Đồng',
      thoi_gian_chay_du_kien: 390,
      trang_thai: true,
    })),
    lockVehicle: vi.fn(async () => ({
      ma_xe: 1,
      ma_loai_xe: 1,
      bien_so_xe: '51B-289.45',
      trang_thai: 'HOAT_DONG',
    })),
    lockDriver: vi.fn(async () => ({
      ma_nguoi_dung: '3',
      ho_va_ten: 'Nguyễn Văn Tài',
      ten_vai_tro: 'TAI_XE',
      trang_thai_tai_khoan: 'HOAT_DONG',
      ma_chi_nhanh: 1,
    })),
    findRouteStops: vi.fn(async () => []),
    findSeatLayout: vi.fn(async () => []),
    findVehicleConflict: vi.fn(async () => null),
    findDriverConflict: vi.fn(async () => null),
    create: vi.fn(async () => 10),
    update: vi.fn(async () => undefined),
    updateStatus: vi.fn(async () => undefined),
    delete: vi.fn(async () => true),
    countTickets: vi.fn(async () => 0),
    findBookedSeatCodes: vi.fn(async () => new Set<string>()),
    findHeldSeatCodes: vi.fn(async () => new Set<string>()),
  };

  return Object.assign(repository, overrides);
}

const createInput = {
  ma_tuyen: 1,
  ma_xe: 1,
  ma_tai_xe: '3',
  thoi_gian_xuat_ben: '2026-10-22T08:00:00+07:00',
  thoi_gian_den_du_kien: '2026-10-22T14:30:00+07:00',
  gia_ve_co_ban: 320000,
};

describe('TripService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a trip after validating route, vehicle, driver and conflicts', async () => {
    const repository = createRepository();
    const service = new TripService(repository);

    const result = await service.create(createInput);

    expect(result.ma_chuyen).toBe(10);
    expect(repository.create).toHaveBeenCalledWith(
      {
        ma_tuyen: 1,
        ma_xe: 1,
        ma_tai_xe: '3',
        thoi_gian_xuat_ben: '2026-10-22 01:00:00',
        thoi_gian_den_du_kien: '2026-10-22 07:30:00',
        gia_ve_co_ban: '320000.00',
        trang_thai: 'SAP_CHAY',
      },
      expect.anything(),
    );
  });

  it('rejects a vehicle that is already assigned to an overlapping trip', async () => {
    const repository = createRepository({
      findVehicleConflict: vi.fn(async () => 99),
    });
    const service = new TripService(repository);

    await expect(service.create(createInput)).rejects.toMatchObject({
      statusCode: 409,
      code: 'TRIP_VEHICLE_CONFLICT',
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('prevents a branch manager from assigning a driver from another branch', async () => {
    const repository = createRepository({
      lockDriver: vi.fn(async () => ({
        ma_nguoi_dung: '3',
        ho_va_ten: 'Nguyễn Văn Tài',
        ten_vai_tro: 'TAI_XE',
        trang_thai_tai_khoan: 'HOAT_DONG',
        ma_chi_nhanh: 2,
      })),
    });
    const service = new TripService(repository);

    await expect(
      service.create(createInput, { all: false, ma_chi_nhanh: 1 }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('blocks changing the schedule after tickets have been issued', async () => {
    const repository = createRepository({
      lockTripRow: vi.fn(async () => baseTrip({ ma_xe: 2 })),
      countTickets: vi.fn(async () => 2),
    });
    const service = new TripService(repository);

    await expect(service.update(10, createInput)).rejects.toMatchObject({
      statusCode: 409,
      code: 'TRIP_IN_USE',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid trip status transition', async () => {
    const repository = createRepository({
      findById: vi.fn(async () => baseTrip({ trang_thai: 'HUY' })),
      countTickets: vi.fn(async () => 0),
    });
    const service = new TripService(repository);

    await expect(service.changeStatus(10, 'SAP_CHAY')).rejects.toMatchObject({
      statusCode: 409,
      code: 'TRIP_INVALID_STATUS_TRANSITION',
    });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('lists trips assigned to the current driver with status and date filters', async () => {
    const repository = createRepository({
      list: vi.fn(async () => ({ items: [baseTrip()], total: 1 })),
    });
    const service = new TripService(repository);

    const result = await service.listAssignedToDriver('3', {
      trang_thai: 'SAP_CHAY',
      tu_ngay: '2026-10-22',
      den_ngay: '2026-10-22',
      page: '1',
      limit: '5',
    });

    expect(result.items).toHaveLength(1);
    expect(result.meta).toMatchObject({ page: 1, limit: 5, total: 1, total_pages: 1 });
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        ma_tai_xe: '3',
        trang_thai: 'SAP_CHAY',
        startUtc: expect.any(String),
        endUtc: expect.any(String),
        pagination: { page: 1, limit: 5, offset: 0 },
      }),
    );
  });

  it('rejects an invalid status for the driver trip list', async () => {
    const repository = createRepository();
    const service = new TripService(repository);

    await expect(
      service.listAssignedToDriver('3', { trang_thai: 'KHONG_HOP_LE' }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('marks booked and held seats in the public seat map', async () => {
    const repository = createRepository({
      findSeatLayout: vi.fn(async (): Promise<SeatRecord[]> => [
        { ma_ghe: 1, ky_hieu_ghe: 'A01', tang: 1, hang: 1, cot: 1, loai_cho: 'VIP' },
        { ma_ghe: 2, ky_hieu_ghe: 'A02', tang: 1, hang: 1, cot: 2, loai_cho: 'VIP' },
        { ma_ghe: 3, ky_hieu_ghe: 'A03', tang: 1, hang: 2, cot: 1, loai_cho: 'THUONG' },
      ]),
      findBookedSeatCodes: vi.fn(async () => new Set(['A01'])),
      findHeldSeatCodes: vi.fn(async () => new Set(['A02'])),
    });
    const service = new TripService(repository);

    const seatMap = await service.getSeatMap(10);

    expect(seatMap.tong_so_ghe).toBe(3);
    expect(seatMap.so_ghe_trong).toBe(1);
    expect(seatMap.ghe.map((seat) => seat.trang_thai)).toEqual(['DA_DAT', 'DANG_GIU', 'TRONG']);
  });
});
