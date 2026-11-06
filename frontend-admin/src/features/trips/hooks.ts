import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tripsApi } from '@/api/endpoints/trips';
import { usersApi } from '@/api/endpoints/users';
import { vehiclesApi } from '@/api/endpoints/vehicles';
import { queryKeys } from '@/api/query-keys';
import type { TripInput, TripListFilters, TripStatus } from '@/types/trip';

export function useTrips(filters: TripListFilters) {
  return useQuery({
    queryKey: queryKeys.trips.list(filters),
    queryFn: () => tripsApi.list(filters),
    placeholderData: (previous) => previous,
  });
}

export function useDriverOptions() {
  return useQuery({
    queryKey: queryKeys.users.drivers,
    queryFn: async () => {
      const roles = await usersApi.listRoles();
      const driverRole = roles.find((role) => role.ten_vai_tro === 'TAI_XE');

      if (!driverRole) {
        return [];
      }

      const result = await usersApi.list({
        ma_vai_tro: driverRole.ma_vai_tro,
        trang_thai_tai_khoan: 'HOAT_DONG',
        page: 1,
        limit: 100,
      });

      return result.items;
    },
    staleTime: 5 * 60_000,
  });
}

export function useVehicleOptions() {
  return useQuery({
    queryKey: queryKeys.vehicles.list({ page: 1, limit: 100, trang_thai: 'HOAT_DONG' }),
    queryFn: () => vehiclesApi.list({ page: 1, limit: 100, trang_thai: 'HOAT_DONG' }),
    staleTime: 5 * 60_000,
    select: (result) => result.items,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TripInput) => tripsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trips.all }),
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TripInput }) => tripsApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trips.all }),
  });
}

export function useChangeTripStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: TripStatus }) =>
      tripsApi.changeStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trips.all }),
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => tripsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trips.all }),
  });
}
