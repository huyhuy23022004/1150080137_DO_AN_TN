import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '../../src/common/errors/error-codes';
import { BookingService } from '../../src/modules/bookings/bookings.service';
import type {
  BookingActor,
  BookingListRecord,
  BookingRecord,
  BookingRepositoryPort,
} from '../../src/modules/bookings/bookings.types';
import type { SeatLockService } from '../../src/modules/seat-locks/seat-locks.service';

const NOW = new Date('2026-10-21T08:00:00.000Z');

const ADMIN_ACTOR: BookingActor = {
  ma_nguoi_dung: '1',
  ho_va_ten: 'Quản trị viên',
  ten_vai_tro: 'QUAN_TRI_VIEN',
  ma_chi_nhanh: null,
};

const BRANCH_ACTOR: BookingActor = {
  ma_nguoi_dung: '3',
  ho_va_ten: 'Nhân viên phòng vé',
  ten_vai_tro: 'NHAN_VIEN_PHONG_VE',
  ma_chi_nhanh: 1,
};

const CUSTOMER_ACTOR: BookingActor = {
  ma_nguoi_dung: '7',
  ho_va_ten: 'Khách hàng',
  ten_vai_tro: 'KHACH_HANG',
  ma_chi_nhanh: null,
};

const LIST_ITEM: BookingListRecord = {
  ma_don_ve: '100',
  ma_dinh_danh_don: 'FUTA261021000123',
  ma_khach_hang: null,
  ho_ten_khach: 'Lê Văn Khách',
  so_dien_thoai_khach: '0909999999',
  email_khach: null,
  ma_nhan_vien_ban: null,
  ma_chi_nhanh_ban: 1,
  ten_chi_nhanh: 'Chi nhánh Sài Gòn',
  ma_diem_don: 1,
  ma_diem_tra: 2,
  tong_tien: '320000.00',
  trang_thai_don: 'CHO_THANH_TOAN',
  thoi_gian_tao: '2026-10-21T08:00:00.000Z',
  ma_chuyen: 10,
  ma_tuyen: 1,
  ten_tuyen: 'Sài Gòn - Đà Lạt',
  tinh_di: 'TP.HCM',
  tinh_den: 'Lâm Đồng',
  thoi_gian_xuat_ben: '2026-10-22T01:00:00.000Z',
  danh_sach_ghe: ['A1'],
  so_ve: 1,
  phuong_thuc_thanh_toan: 'TIEN_MAT',
  trang_thai_thanh_toan: 'CHO_XU_LY',
};

function buildOrder(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    ma_don_ve: '100',
    ma_dinh_danh_don: 'FUTA261021000123',
    ma_chuyen: 10,
    ma_khach_hang: null,
    ho_ten_khach: 'Lê Văn Khách',
    so_dien_thoai_khach: '0909999999',
    email_khach: null,
    ma_nhan_vien_ban: null,
    ma_chi_nhanh_ban: 1,
    ma_diem_don: 1,
    ma_diem_tra: 2,
    tong_tien: '320000.00',
    trang_thai_don: 'CHO_THANH_TOAN',
    thoi_gian_tao: NOW.toISOString(),
    chi_tiet_ve: [],
    thanh_toan: [],
    ...overrides,
  };
}

function createHarness() {
  const repository = {
    list: vi.fn(async () => ({ items: [] as BookingListRecord[], total: 0 })),
    findOrderByIdentifier: vi.fn(async () => null as BookingRecord | null),
  } as unknown as BookingRepositoryPort;

  const service = new BookingService({
    repository,
    seatLocks: {} as unknown as SeatLockService,
    orderCodeGenerator: { next: vi.fn(async () => 'FUTA261021009999') },
    idempotencyStore: {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    },
    customerProfiles: { findUserById: vi.fn(async () => null) },
    paymentTimeoutMinutes: 15,
    now: () => NOW,
  });

  return { service, repository };
}

describe('BookingService list và tra cứu theo mã', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ép nhân viên chi nhánh chỉ xem đơn của chi nhánh mình', async () => {
    const { service, repository } = createHarness();
    vi.mocked(repository.list).mockResolvedValue({ items: [LIST_ITEM], total: 12 });

    const result = await service.list(
      { ma_chi_nhanh: '1', page: '2', limit: '10', trang_thai_don: 'cho_thanh_toan' },
      BRANCH_ACTOR,
    );

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        ma_chi_nhanh: 1,
        include_unassigned_branch: true,
        trang_thai_don: 'CHO_THANH_TOAN',
        pagination: { page: 2, limit: 10, offset: 10 },
      }),
    );
    expect(result.items[0]?.thoi_gian_het_han).toBe('2026-10-21T08:15:00.000Z');
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 12, total_pages: 2 });
  });

  it('cho phép quản trị viên lọc theo chi nhánh bất kỳ', async () => {
    const { service, repository } = createHarness();

    await service.list({ ma_chi_nhanh: '2' }, ADMIN_ACTOR);

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        ma_chi_nhanh: 2,
        include_unassigned_branch: false,
      }),
    );
  });

  it('chặn nhân viên chi nhánh lọc sang chi nhánh khác', async () => {
    const { service, repository } = createHarness();

    await expect(service.list({ ma_chi_nhanh: '2' }, BRANCH_ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.FORBIDDEN,
    });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('chặn khách hàng truy cập danh sách đơn', async () => {
    const { service } = createHarness();

    await expect(service.list({}, CUSTOMER_ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.FORBIDDEN,
    });
  });

  it('chuyển khoảng ngày Việt Nam sang mốc UTC trước khi truy vấn', async () => {
    const { service, repository } = createHarness();

    await service.list({ tu_ngay: '2026-10-21', den_ngay: '2026-10-21' }, ADMIN_ACTOR);

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        start_utc: '2026-10-20 17:00:00',
        end_utc: '2026-10-21 17:00:00',
      }),
    );
  });

  it('tra cứu đơn theo mã, chuẩn hóa chữ hoa và trả hạn thanh toán', async () => {
    const { service, repository } = createHarness();
    vi.mocked(repository.findOrderByIdentifier).mockResolvedValue(buildOrder());

    const result = await service.getByCode(' futa261021000123 ', BRANCH_ACTOR);

    expect(repository.findOrderByIdentifier).toHaveBeenCalledWith('FUTA261021000123');
    expect(result.ma_dinh_danh_don).toBe('FUTA261021000123');
    expect(result.thoi_gian_het_han).toBe('2026-10-21T08:15:00.000Z');
  });

  it('trả lỗi khi mã đơn không tồn tại', async () => {
    const { service } = createHarness();

    await expect(service.getByCode('FUTA261021000404', ADMIN_ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.BOOKING_NOT_FOUND,
    });
  });

  it('chặn nhân viên chi nhánh tra cứu đơn của chi nhánh khác', async () => {
    const { service, repository } = createHarness();
    vi.mocked(repository.findOrderByIdentifier).mockResolvedValue(
      buildOrder({ ma_chi_nhanh_ban: 2 }),
    );

    await expect(service.getByCode('FUTA261021000123', BRANCH_ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.FORBIDDEN,
    });
  });
});
