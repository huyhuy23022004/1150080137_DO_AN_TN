import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '../../src/common/errors/error-codes';
import { StatisticsService } from '../../src/modules/statistics/statistics.service';
import type {
  RevenueFilters,
  StatisticsRepositoryPort,
} from '../../src/modules/statistics/statistics.types';

const NOW = new Date('2026-10-21T08:00:00.000Z');

const ADMIN = { ten_vai_tro: 'QUAN_TRI_VIEN' as const, ma_chi_nhanh: null };
const BRANCH_MANAGER = {
  ten_vai_tro: 'QUAN_LY_CHI_NHANH' as const,
  ma_chi_nhanh: 2,
};

function createHarness() {
  const filtersSeen: RevenueFilters[] = [];

  const repository: StatisticsRepositoryPort = {
    summary: vi.fn(async (filters) => {
      filtersSeen.push(filters);
      return {
        tong_doanh_thu: '1280000.00',
        so_don: 2,
        so_ve: 4,
        so_ve_da_soat: 3,
      };
    }),
    revenueByTime: vi.fn(async () => [
      {
        ky: '2026-10-20',
        tong_doanh_thu: '640000.00',
        so_don: 1,
        so_ve: 2,
        so_ve_da_soat: 2,
      },
      {
        ky: '2026-10-21',
        tong_doanh_thu: '640000.00',
        so_don: 1,
        so_ve: 2,
        so_ve_da_soat: 1,
      },
    ]),
    revenueByRoute: vi.fn(async () => [
      {
        ma_tuyen: 1,
        ten_tuyen: 'Sài Gòn - Đà Lạt',
        tinh_di: 'TP.HCM',
        tinh_den: 'Lâm Đồng',
        tong_doanh_thu: '1280000.00',
        so_don: 2,
        so_ve: 4,
        so_ve_da_soat: 3,
      },
    ]),
    revenueByBranch: vi.fn(async () => [
      {
        ma_chi_nhanh: null,
        ten_chi_nhanh: 'Kênh trực tuyến',
        tong_doanh_thu: '1280000.00',
        so_don: 2,
        so_ve: 4,
        so_ve_da_soat: 3,
      },
    ]),
  };

  const service = new StatisticsService({ repository, now: () => NOW });
  return { service, repository, filtersSeen };
}

describe('StatisticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to the last 30 days in Vietnam time', async () => {
    const harness = createHarness();
    const report = await harness.service.getRevenue(ADMIN, {});

    expect(report.range).toEqual({
      tu_ngay: '2026-09-22',
      den_ngay: '2026-10-21',
      start_utc: '2026-09-21 17:00:00',
      end_utc: '2026-10-21 17:00:00',
    });
    expect(report.group_by).toBe('day');
    expect(report.summary.tong_doanh_thu).toBe('1280000.00');
    expect(report.items).toHaveLength(2);
  });

  it('supports explicit range and monthly grouping', async () => {
    const harness = createHarness();
    await harness.service.getRevenue(ADMIN, {
      tu_ngay: '2026-01-01',
      den_ngay: '2026-06-30',
      group_by: 'month',
    });

    expect(harness.repository.revenueByTime).toHaveBeenCalledWith({
      startUtc: '2025-12-31 17:00:00',
      endUtc: '2026-06-30 17:00:00',
      branchId: null,
      groupBy: 'month',
    });
  });

  it('forces branch managers to their own branch', async () => {
    const harness = createHarness();
    await harness.service.getRevenue(BRANCH_MANAGER, {});

    const filters = harness.filtersSeen[0];
    expect(filters?.branchId).toBe(2);

    await expect(
      harness.service.getRevenue(BRANCH_MANAGER, { ma_chi_nhanh: 3 }),
    ).rejects.toMatchObject({ code: ERROR_CODES.FORBIDDEN });
  });

  it('rejects an invalid date range', async () => {
    const harness = createHarness();

    await expect(
      harness.service.getRevenue(ADMIN, {
        tu_ngay: '2026-12-31',
        den_ngay: '2026-01-01',
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });

    await expect(
      harness.service.getRevenue(ADMIN, { tu_ngay: '31-12-2026' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });
  });

  it('returns revenue grouped by route and by branch', async () => {
    const harness = createHarness();

    const byRoute = await harness.service.getRevenueByRoute(ADMIN, {});
    const byBranch = await harness.service.getRevenueByBranch(ADMIN, {});

    expect(byRoute.items[0]?.ten_tuyen).toBe('Sài Gòn - Đà Lạt');
    expect(byBranch.items[0]?.ten_chi_nhanh).toBe('Kênh trực tuyến');
    expect(byRoute.summary.so_ve).toBe(4);
    expect(byBranch.summary.so_ve_da_soat).toBe(3);
  });
});
