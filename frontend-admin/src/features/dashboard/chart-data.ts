import dayjs from 'dayjs';
import type { RevenueBranchItem, RevenueRouteItem, RevenueTimeItem } from '@/types/statistics';

export interface RevenueTimePoint {
  label: string;
  doanh_thu: number;
  so_don: number;
  so_ve: number;
}

export interface NamedRevenuePoint {
  name: string;
  doanh_thu: number;
  so_don: number;
  so_ve: number;
}

export function toAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toTimeChartData(
  items: RevenueTimeItem[],
  groupBy: 'day' | 'month',
): RevenueTimePoint[] {
  return items.map((item) => ({
    label: dayjs(item.ky).format(groupBy === 'month' ? 'MM/YYYY' : 'DD/MM'),
    doanh_thu: toAmount(item.tong_doanh_thu),
    so_don: item.so_don,
    so_ve: item.so_ve,
  }));
}

export function toRouteChartData(items: RevenueRouteItem[], limit = 8): NamedRevenuePoint[] {
  return items.slice(0, limit).map((item) => ({
    name: item.ten_tuyen,
    doanh_thu: toAmount(item.tong_doanh_thu),
    so_don: item.so_don,
    so_ve: item.so_ve,
  }));
}

export function toBranchChartData(items: RevenueBranchItem[]): NamedRevenuePoint[] {
  return items.map((item) => ({
    name: item.ten_chi_nhanh || 'Không xác định',
    doanh_thu: toAmount(item.tong_doanh_thu),
    so_don: item.so_don,
    so_ve: item.so_ve,
  }));
}
