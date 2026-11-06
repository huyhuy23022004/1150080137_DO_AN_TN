import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import type { AuthUserRecord } from '../../src/modules/auth/auth.types';
import type { StatisticsService } from '../../src/modules/statistics/statistics.service';
import { buildTestAuth, type TestAuthContext } from '../helpers/build-test-auth';

const ADMIN: AuthUserRecord = {
  ma_nguoi_dung: '1',
  ma_vai_tro: 2,
  ma_chi_nhanh: null,
  ho_va_ten: 'Quản trị viên',
  so_dien_thoai: '0900000000',
  email: 'admin@example.com',
  mat_khau_ma_hoa: 'hash',
  trang_thai_tai_khoan: 'HOAT_DONG',
  thoi_gian_tao: '2026-01-01T00:00:00.000Z',
  ten_vai_tro: 'QUAN_TRI_VIEN',
};

const CUSTOMER: AuthUserRecord = {
  ...ADMIN,
  ma_nguoi_dung: '7',
  ma_vai_tro: 1,
  ho_va_ten: 'Khách hàng',
  so_dien_thoai: '0901234567',
  ten_vai_tro: 'KHACH_HANG',
};

const REPORT = {
  range: {
    tu_ngay: '2026-09-22',
    den_ngay: '2026-10-21',
    start_utc: '2026-09-21 17:00:00',
    end_utc: '2026-10-21 17:00:00',
  },
  group_by: 'day',
  summary: { tong_doanh_thu: '1280000.00', so_don: 2, so_ve: 4, so_ve_da_soat: 3 },
  items: [],
};

function buildApp(context: TestAuthContext, statisticsService: StatisticsService): Express {
  return createApp({
    authService: context.authService,
    tokenService: context.tokenService,
    statisticsService,
  });
}

function bearer(context: TestAuthContext, user: AuthUserRecord): string {
  return `Bearer ${context.tokenService.signAccessToken(user)}`;
}

describe('Statistics API', () => {
  let context: TestAuthContext;
  let app: Express;
  let service: {
    getRevenue: ReturnType<typeof vi.fn>;
    getRevenueByRoute: ReturnType<typeof vi.fn>;
    getRevenueByBranch: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    context = buildTestAuth();
    service = {
      getRevenue: vi.fn(async () => REPORT),
      getRevenueByRoute: vi.fn(async () => REPORT),
      getRevenueByBranch: vi.fn(async () => REPORT),
    };
    app = buildApp(context, service as unknown as StatisticsService);
  });

  it('returns the revenue report for an admin', async () => {
    const response = await request(app)
      .get('/api/v1/statistics/revenue?tu_ngay=2026-09-22&den_ngay=2026-10-21')
      .set('Authorization', bearer(context, ADMIN));

    expect(response.status).toBe(200);
    expect(response.body.data.bao_cao_doanh_thu.summary.so_ve).toBe(4);
    expect(service.getRevenue).toHaveBeenCalledWith(
      expect.objectContaining({ ten_vai_tro: 'QUAN_TRI_VIEN' }),
      expect.objectContaining({ tu_ngay: '2026-09-22' }),
    );
  });

  it('returns revenue grouped by route and branch', async () => {
    const route = await request(app)
      .get('/api/v1/statistics/revenue/by-route')
      .set('Authorization', bearer(context, ADMIN));
    const branch = await request(app)
      .get('/api/v1/statistics/revenue/by-branch')
      .set('Authorization', bearer(context, ADMIN));

    expect(route.status).toBe(200);
    expect(branch.status).toBe(200);
    expect(route.body.data).toHaveProperty('bao_cao_doanh_thu_theo_tuyen');
    expect(branch.body.data).toHaveProperty('bao_cao_doanh_thu_theo_chi_nhanh');
  });

  it('rejects customers and invalid group_by values', async () => {
    const forbidden = await request(app)
      .get('/api/v1/statistics/revenue')
      .set('Authorization', bearer(context, CUSTOMER));
    const invalid = await request(app)
      .get('/api/v1/statistics/revenue?group_by=year')
      .set('Authorization', bearer(context, ADMIN));

    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(422);
  });
});
