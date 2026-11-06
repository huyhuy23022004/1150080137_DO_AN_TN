import { useQuery } from '@tanstack/react-query';
import { branchesApi } from '@/api/endpoints/branches';
import { statisticsApi } from '@/api/endpoints/statistics';
import { queryKeys } from '@/api/query-keys';
import type { RevenueFilters, RevenueTimeFilters } from '@/types/statistics';

export function useRevenueTimeReport(filters: RevenueTimeFilters) {
  return useQuery({
    queryKey: queryKeys.statistics.revenue(filters),
    queryFn: () => statisticsApi.getRevenue(filters),
  });
}

export function useRevenueByRoute(filters: RevenueFilters) {
  return useQuery({
    queryKey: queryKeys.statistics.byRoute(filters),
    queryFn: () => statisticsApi.getRevenueByRoute(filters),
  });
}

export function useRevenueByBranch(filters: RevenueFilters, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.statistics.byBranch(filters),
    queryFn: () => statisticsApi.getRevenueByBranch(filters),
    enabled,
  });
}

export function useBranchOptions(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.branches.options,
    queryFn: () => branchesApi.listActive(),
    enabled,
    staleTime: 5 * 60_000,
  });
}
