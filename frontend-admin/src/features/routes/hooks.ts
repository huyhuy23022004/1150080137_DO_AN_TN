import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { routesApi } from '@/api/endpoints/routes';
import { queryKeys } from '@/api/query-keys';
import type { RouteInput, RouteListFilters } from '@/types/route';

export function useRoutes(filters: RouteListFilters) {
  return useQuery({
    queryKey: queryKeys.routes.list(filters),
    queryFn: () => routesApi.list(filters),
    placeholderData: (previous) => previous,
  });
}

export function useRouteOptions() {
  return useQuery({
    queryKey: queryKeys.routes.options,
    queryFn: () => routesApi.listOptions(),
    staleTime: 5 * 60_000,
  });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RouteInput) => routesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.routes.all }),
  });
}

export function useUpdateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RouteInput }) => routesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.routes.all }),
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => routesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.routes.all }),
  });
}
