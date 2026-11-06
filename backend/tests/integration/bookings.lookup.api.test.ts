import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import type { AuthUserRecord } from '../../src/modules/auth/auth.types';
import type { BookingService } from '../../src/modules/bookings/bookings.service';
import type { BookingListItem } from '../../src/modules/bookings/bookings.types';
import { buildTestAuth, type TestAuthContext } from '../helpers/build-test-auth';

const ADMIN: AuthUserRecord = {
  ma_nguoi_dung: '1',
  ma_vai_tro: 1,
  ma_chi_nhanh: null,
  ho_va_ten: 'Quản trị viên',
  so_dien_thoai: '0900000001',
  email: 'admin@example.com',
  mat_khau_ma_hoa: 'hash',
  trang_thai_tai_khoan: 'HOAT_DONG',
  thoi_gian_tao: '2026-01-01T00:00:00.000Z',
  ten_vai_tro: 'QUAN_TRI_VIEN',
};

const CUSTOMER: AuthUserRecord = {
  ...ADMIN,
  ma_nguoi_dung: '7',
  ma_vai_tro: 4,
  ho_va_ten: 'Khách hàng',
  so_dien_thoai: '0901234567',
  email: 'khach@example.com',
  ten_vai_tro: 'KHACH_HANG',
};

const ITEM: BookingListItem = {
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
  thoi_gian_het_han: '2026-10-21T08:15:00.000Z',
};

function bearer(context: TestAuthContext, user: AuthUserRecord = ADMIN): string {
  return `Bearer ${context.tokenService.signAccessToken(user)}`;
}

describe('Bookings lookup API', () => {
  let context: TestAuthContext;
  let app: Express;
  let service: {
    list: ReturnType<typeof vi.fn>;
    getByCode: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    context = buildTestAuth();
    service = {
      list: vi.fn(async () => ({
        items: [ITEM],
        meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
      })),
      getByCode: vi.fn(async () => ({
        ma_don_ve: '100',
        ma_dinh_danh_don: 'FUTA261021000123',
      })),
    };
    app = createApp({
      authService: context.authService,
      tokenService: context.tokenService,
      bookingService: service as unknown as BookingService,
    });
  });

  it('trả danh sách đơn có phân trang cho nhân viên', async () => {
    const response = await request(app)
      .get('/api/v1/bookings')
      .query({ ma_chi_nhanh: 1, page: 1, limit: 20 })
      .set('Authorization', bearer(context));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].ma_dinh_danh_don).toBe('FUTA261021000123');
    expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 1, total_pages: 1 });
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ ma_chi_nhanh: '1', page: '1', limit: '20' }),
      expect.objectContaining({ ma_nguoi_dung: '1', ten_vai_tro: 'QUAN_TRI_VIEN' }),
    );
  });

  it('định tuyến by-code trước route id và trả chi tiết đơn', async () => {
    const response = await request(app)
      .get('/api/v1/bookings/by-code/FUTA261021000123')
      .set('Authorization', bearer(context));

    expect(response.status).toBe(200);
    expect(response.body.data.don_dat_ve.ma_dinh_danh_don).toBe('FUTA261021000123');
    expect(service.getByCode).toHaveBeenCalledWith(
      'FUTA261021000123',
      expect.objectContaining({ ten_vai_tro: 'QUAN_TRI_VIEN' }),
    );
  });

  it('trả 422 khi mã đơn sai định dạng', async () => {
    const response = await request(app)
      .get('/api/v1/bookings/by-code/abc def')
      .set('Authorization', bearer(context));

    expect(response.status).toBe(422);
    expect(service.getByCode).not.toHaveBeenCalled();
  });

  it('chặn khách hàng truy cập danh sách đơn', async () => {
    const response = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', bearer(context, CUSTOMER));

    expect(response.status).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });
});
