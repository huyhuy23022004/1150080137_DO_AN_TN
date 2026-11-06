import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleTypesApi } from '@/api/endpoints/vehicle-types';
import { queryKeys } from '@/api/query-keys';
import type { VehicleTypeInput, VehicleTypeListFilters } from '@/types/vehicle-type';

export function useVehicleTypes(filters: VehicleTypeListFilters) {
  return useQuery({
    queryKey: queryKeys.vehicleTypes.list(filters),
    queryFn: () => vehicleTypesApi.list(filters),
    placeholderData: (previous) => previous,
  });
}

export function useVehicleTypeOptions() {
  return useQuery({
    queryKey: queryKeys.vehicleTypes.options,
    queryFn: () => vehicleTypesApi.listOptions(),
    staleTime: 5 * 60_000,
  });
}

export function useCreateVehicleType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VehicleTypeInput) => vehicleTypesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vehicleTypes.all }),
  });
}

export function useUpdateVehicleType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: VehicleTypeInput }) =>
      vehicleTypesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vehicleTypes.all }),
  });
}

export function useDeleteVehicleType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => vehicleTypesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.vehicleTypes.all }),
  });
}
