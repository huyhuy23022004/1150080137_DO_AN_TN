export interface StatisticsRange {
  tu_ngay: string;
  den_ngay: string;
  start_utc: string;
  end_utc: string;
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

export interface RevenueFilters {
  tu_ngay: string;
  den_ngay: string;
  ma_chi_nhanh?: number;
}

export interface RevenueTimeFilters extends RevenueFilters {
  group_by: 'day' | 'month';
}
