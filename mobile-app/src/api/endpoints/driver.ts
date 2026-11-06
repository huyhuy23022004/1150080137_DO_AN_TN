import type { ApiEnvelope } from '../../types/api';
import type { DriverTripFilters } from '../../types/driver';
import type { Trip } from '../../types/trip';
import { apiClient } from '../client';

export const driverApi = {
  async listTrips(filters: DriverTripFilters = {}): Promise<{
    items: Trip[];
    meta: { page: number; limit: number; total: number; total_pages: number };
  }> {
    const params: Record<string, string | number> = {
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
    };

    if (filters.trang_thai) {
      params.trang_thai = filters.trang_thai;
    }

    if (filters.tu_ngay) {
      params.tu_ngay = filters.tu_ngay;
    }

    if (filters.den_ngay) {
      params.den_ngay = filters.den_ngay;
    }

    const response = await apiClient.get<ApiEnvelope<Trip[]>>('/driver/trips', { params });
    return {
      items: response.data.data,
      meta: response.data.meta ?? {
        page: filters.page ?? 1,
        limit: filters.limit ?? 50,
        total: response.data.data.length,
        total_pages: 1,
      },
    };
  },
};
