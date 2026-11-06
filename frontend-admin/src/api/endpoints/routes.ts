import type { ApiEnvelope } from '@/types/api';
import type { Route, RouteInput, RouteListFilters, RouteListResult } from '@/types/route';
import { http } from '../http';

export const routesApi = {
  async list(filters: RouteListFilters): Promise<RouteListResult> {
    const response = await http.get<ApiEnvelope<Route[]>>('/routes', { params: filters });

    return {
      items: response.data.data,
      meta: (response.data.meta ?? {
        page: filters.page,
        limit: filters.limit,
        total: response.data.data.length,
        total_pages: 1,
      }) as RouteListResult['meta'],
    };
  },

  async listOptions(): Promise<Route[]> {
    const response = await http.get<ApiEnvelope<Route[]>>('/routes', {
      params: { limit: 100, trang_thai: 'true' },
    });
    return response.data.data;
  },

  async getById(id: number): Promise<Route> {
    const response = await http.get<ApiEnvelope<{ tuyen_duong: Route }>>(`/routes/${id}`);
    return response.data.data.tuyen_duong;
  },

  async create(input: RouteInput): Promise<Route> {
    const response = await http.post<ApiEnvelope<{ tuyen_duong: Route }>>('/routes', input);
    return response.data.data.tuyen_duong;
  },

  async update(id: number, input: RouteInput): Promise<Route> {
    const response = await http.put<ApiEnvelope<{ tuyen_duong: Route }>>(`/routes/${id}`, input);
    return response.data.data.tuyen_duong;
  },

  async delete(id: number): Promise<void> {
    await http.delete(`/routes/${id}`);
  },
};
