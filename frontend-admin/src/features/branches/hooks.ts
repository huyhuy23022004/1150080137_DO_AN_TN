import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchesApi } from '@/api/endpoints/branches';
import { queryKeys } from '@/api/query-keys';
import type { BranchInput, BranchListFilters } from '@/types/branch';

export function useBranches(filters: BranchListFilters) {
  return useQuery({
    queryKey: queryKeys.branches.list(filters),
    queryFn: () => branchesApi.list(filters),
    placeholderData: (previous) => previous,
  });
}

export function useBranchOptions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.branches.options,
    queryFn: () => branchesApi.listActive(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useBranch(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.branches.detail(id ?? 0),
    queryFn: () => branchesApi.getById(id as number),
    enabled: id !== undefined,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BranchInput) => branchesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.branches.all }),
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: BranchInput }) =>
      branchesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.branches.all }),
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => branchesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.branches.all }),
  });
}
