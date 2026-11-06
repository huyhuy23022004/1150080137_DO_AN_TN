import type { ApiEnvelope } from '@/types/api';
import type { Vehicle, VehicleInput, VehicleListFilters, VehicleListResult } from '@/types/vehicle';
import { http } from '../http';

export const vehiclesApi = {
  async list(filters: VehicleListFilters): Promise<VehicleListResult> {
    const response = await http.get<ApiEnvelope<Vehicle[]>>('/vehicles', { params: filters });

    return {
      items: response.data.data,
      meta: (response.data.meta ?? {
        page: filters.page,
        limit: filters.limit,
        total: response.data.data.length,
        total_pages: 1,
      }) as VehicleListResult['meta'],
    };
  },

  async getById(id: number): Promise<Vehicle> {
    const response = await http.get<ApiEnvelope<{ xe: Vehicle }>>(`/vehicles/${id}`);
    return response.data.data.xe;
  },

  async create(input: VehicleInput): Promise<Vehicle> {
    const response = await http.post<ApiEnvelope<{ xe: Vehicle }>>('/vehicles', input);
    return response.data.data.xe;
  },

  async update(id: number, input: VehicleInput): Promise<Vehicle> {
    const response = await http.put<ApiEnvelope<{ xe: Vehicle }>>(`/vehicles/${id}`, input);
    return response.data.data.xe;
  },

  async delete(id: number): Promise<void> {
    await http.delete(`/vehicles/${id}`);
  },
};
