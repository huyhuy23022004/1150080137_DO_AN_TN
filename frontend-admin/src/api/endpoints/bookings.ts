import type { ApiEnvelope } from '@/types/api';
import type {
  BookingDetail,
  BookingListFilters,
  BookingListResult,
  BookingListItem,
} from '@/types/booking';
import { http } from '../http';

export const bookingsApi = {
  async list(filters: BookingListFilters): Promise<BookingListResult> {
    const response = await http.get<ApiEnvelope<BookingListItem[]>>('/bookings', {
      params: filters,
    });

    return {
      items: response.data.data,
      meta: (response.data.meta ?? {
        page: filters.page,
        limit: filters.limit,
        total: response.data.data.length,
        total_pages: 1,
      }) as BookingListResult['meta'],
    };
  },

  async getById(id: string): Promise<BookingDetail> {
    const response = await http.get<ApiEnvelope<{ don_dat_ve: BookingDetail }>>(`/bookings/${id}`);
    return response.data.data.don_dat_ve;
  },

  async getByCode(code: string): Promise<BookingDetail> {
    const response = await http.get<ApiEnvelope<{ don_dat_ve: BookingDetail }>>(
      `/bookings/by-code/${encodeURIComponent(code)}`,
    );
    return response.data.data.don_dat_ve;
  },

  async cancel(id: string): Promise<BookingDetail> {
    const response = await http.post<ApiEnvelope<{ don_dat_ve: BookingDetail }>>(
      `/bookings/${id}/cancel`,
    );
    return response.data.data.don_dat_ve;
  },

  async confirmCash(id: string): Promise<BookingDetail> {
    const response = await http.post<ApiEnvelope<{ don_dat_ve: BookingDetail }>>(
      `/bookings/${id}/confirm-cash`,
    );
    return response.data.data.don_dat_ve;
  },
};
