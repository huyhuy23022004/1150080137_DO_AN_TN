import type { ApiEnvelope } from '@/types/api';
import type {
  RevenueBranchReport,
  RevenueRouteReport,
  RevenueTimeFilters,
  RevenueTimeReport,
} from '@/types/statistics';
import { http } from '../http';

export const statisticsApi = {
  async getRevenue(filters: RevenueTimeFilters): Promise<RevenueTimeReport> {
    const response = await http.get<ApiEnvelope<{ bao_cao_doanh_thu: RevenueTimeReport }>>(
      '/statistics/revenue',
      { params: filters },
    );
    return response.data.data.bao_cao_doanh_thu;
  },

  async getRevenueByRoute(
    filters: Omit<RevenueTimeFilters, 'group_by'>,
  ): Promise<RevenueRouteReport> {
    const response = await http.get<
      ApiEnvelope<{ bao_cao_doanh_thu_theo_tuyen: RevenueRouteReport }>
    >('/statistics/revenue/by-route', { params: filters });
    return response.data.data.bao_cao_doanh_thu_theo_tuyen;
  },

  async getRevenueByBranch(
    filters: Omit<RevenueTimeFilters, 'group_by'>,
  ): Promise<RevenueBranchReport> {
    const response = await http.get<
      ApiEnvelope<{ bao_cao_doanh_thu_theo_chi_nhanh: RevenueBranchReport }>
    >('/statistics/revenue/by-branch', { params: filters });
    return response.data.data.bao_cao_doanh_thu_theo_chi_nhanh;
  },
};
