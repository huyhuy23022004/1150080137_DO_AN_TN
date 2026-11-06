import type { ApiEnvelope } from '@/types/api';
import type {
  Trip,
  TripDetail,
  TripInput,
  TripListFilters,
  TripListResult,
  TripStatus,
} from '@/types/trip';
import { http } from '../http';

export const tripsApi = {
  async list(filters: TripListFilters): Promise<TripListResult> {
    const response = await http.get<ApiEnvelope<Trip[]>>('/admin/trips', { params: filters });

    return {
      items: response.data.data,
      meta: (response.data.meta ?? {
        page: filters.page,
        limit: filters.limit,
        total: response.data.data.length,
        total_pages: 1,
      }) as TripListResult['meta'],
    };
  },

  async getById(id: number): Promise<TripDetail> {
    const response = await http.get<ApiEnvelope<{ chuyen_xe: TripDetail }>>(`/admin/trips/${id}`);
    return response.data.data.chuyen_xe;
  },

  async create(input: TripInput): Promise<TripDetail> {
    const response = await http.post<ApiEnvelope<{ chuyen_xe: TripDetail }>>('/admin/trips', input);
    return response.data.data.chuyen_xe;
  },

  async update(id: number, input: TripInput): Promise<TripDetail> {
    const response = await http.put<ApiEnvelope<{ chuyen_xe: TripDetail }>>(
      `/admin/trips/${id}`,
      input,
    );
    return response.data.data.chuyen_xe;
  },

  async changeStatus(id: number, trang_thai: TripStatus): Promise<TripDetail> {
    const response = await http.patch<ApiEnvelope<{ chuyen_xe: TripDetail }>>(
      `/admin/trips/${id}/status`,
      { trang_thai },
    );
    return response.data.data.chuyen_xe;
  },

  async delete(id: number): Promise<void> {
    await http.delete(`/admin/trips/${id}`);
  },
};
