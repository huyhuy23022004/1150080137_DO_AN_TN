import type { RoleName } from '../../common/constants';

export interface StatisticsActor {
  ten_vai_tro: RoleName;
  ma_chi_nhanh: number | null;
}

export interface StatisticsQuery {
  tu_ngay?: unknown;
  den_ngay?: unknown;
  ma_chi_nhanh?: unknown;
  group_by?: unknown;
}

export interface StatisticsRange {
  tu_ngay: string;
  den_ngay: string;
  start_utc: string;
  end_utc: string;
}

export interface RevenueFilters {
  startUtc: string;
  endUtc: string;
  branchId: number | null;
}

export interface RevenueTimeFilters extends RevenueFilters {
  groupBy: 'day' | 'month';
}

export interface RevenueSummary {
  tong_doanh_thu: string;
  so_don: number;
  so_ve: number;
  so_ve_da_soat: number;
}

export interface RevenueTimeItem {
  ky: string;
  tong_doanh_thu: string;
  so_don: number;
  so_ve: number;
  so_ve_da_soat: number;
}

export interface RevenueRouteItem {
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  tong_doanh_thu: string;
  so_don: number;
  so_ve: number;
  so_ve_da_soat: number;
}

export interface RevenueBranchItem {
  ma_chi_nhanh: number | null;
  ten_chi_nhanh: string;
  tong_doanh_thu: string;
  so_don: number;
  so_ve: number;
  so_ve_da_soat: number;
}

export interface RevenueTimeReport {
  range: StatisticsRange;
  group_by: 'day' | 'month';
  summary: RevenueSummary;
  items: RevenueTimeItem[];
}

export interface RevenueRouteReport {
  range: StatisticsRange;
  summary: RevenueSummary;
  items: RevenueRouteItem[];
}

export interface RevenueBranchReport {
  range: StatisticsRange;
  summary: RevenueSummary;
  items: RevenueBranchItem[];
}

export interface StatisticsRepositoryPort {
  summary(filters: RevenueFilters): Promise<RevenueSummary>;
  revenueByTime(filters: RevenueTimeFilters): Promise<RevenueTimeItem[]>;
  revenueByRoute(filters: RevenueFilters): Promise<RevenueRouteItem[]>;
  revenueByBranch(filters: RevenueFilters): Promise<RevenueBranchItem[]>;
}
