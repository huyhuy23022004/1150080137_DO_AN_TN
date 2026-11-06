import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from '@/api/endpoints/vehicles';
import { queryKeys } from '@/api/query-keys';
import type { VehicleInput, VehicleListFilters } from '@/types/vehicle';

export function useVehicles(filters: VehicleListFilters) {
  return useQuery({
    queryKey: queryKeys.vehicles.list(filters),
    queryFn: () => vehiclesApi.list(filters),
    placeholderData: (previous) => previous,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VehicleInput) => vehiclesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all }),
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: VehicleInput }) =>
      vehiclesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all }),
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => vehiclesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all }),
  });
}
