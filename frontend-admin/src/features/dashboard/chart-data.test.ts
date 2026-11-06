import { describe, expect, it } from 'vitest';
import type { RevenueBranchItem, RevenueRouteItem, RevenueTimeItem } from '@/types/statistics';
import { toAmount, toBranchChartData, toRouteChartData, toTimeChartData } from './chart-data';

describe('dashboard chart data', () => {
  it('parses bigint money strings', () => {
    expect(toAmount('1500000')).toBe(1_500_000);
    expect(toAmount('invalid')).toBe(0);
  });

  it('maps daily and monthly labels', () => {
    const items: RevenueTimeItem[] = [
      {
        ky: '2026-10-21',
        tong_doanh_thu: '500000',
        so_don: 2,
        so_ve: 3,
        so_ve_da_soat: 1,
      },
    ];

    expect(toTimeChartData(items, 'day')).toEqual([
      { label: '21/10', doanh_thu: 500_000, so_don: 2, so_ve: 3 },
    ]);
    expect(toTimeChartData(items, 'month')[0]?.label).toBe('10/2026');
  });

  it('limits route chart items', () => {
    const items: RevenueRouteItem[] = Array.from({ length: 10 }, (_, index) => ({
      ma_tuyen: index + 1,
      ten_tuyen: `Tuyến ${index + 1}`,
      tinh_di: 'A',
      tinh_den: 'B',
      tong_doanh_thu: String((index + 1) * 100_000),
      so_don: 1,
      so_ve: 1,
      so_ve_da_soat: 0,
    }));

    const chart = toRouteChartData(items, 3);
    expect(chart).toHaveLength(3);
    expect(chart[0]?.name).toBe('Tuyến 1');
  });

  it('falls back for unnamed branches', () => {
    const items: RevenueBranchItem[] = [
      {
        ma_chi_nhanh: null,
        ten_chi_nhanh: '',
        tong_doanh_thu: '0',
        so_don: 0,
        so_ve: 0,
        so_ve_da_soat: 0,
      },
    ];

    expect(toBranchChartData(items)[0]?.name).toBe('Không xác định');
  });
});
