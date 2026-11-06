import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/api/endpoints/bookings';
import { queryKeys } from '@/api/query-keys';
import type { BookingListFilters } from '@/types/booking';

export function useBookings(filters: BookingListFilters) {
  return useQuery({
    queryKey: queryKeys.bookings.list(filters),
    queryFn: () => bookingsApi.list(filters),
    placeholderData: (previous) => previous,
  });
}

export function useBookingDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.bookings.detail(id ?? ''),
    queryFn: () => bookingsApi.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: (booking) => {
      queryClient.setQueryData(queryKeys.bookings.detail(booking.ma_don_ve), booking);
      return queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}

export function useConfirmCashBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => bookingsApi.confirmCash(id),
    onSuccess: (booking) => {
      queryClient.setQueryData(queryKeys.bookings.detail(booking.ma_don_ve), booking);
      return queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
  });
}
