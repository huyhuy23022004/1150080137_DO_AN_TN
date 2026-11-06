import type { ApiEnvelope } from '@/types/api';
import type {
  VehicleType,
  VehicleTypeInput,
  VehicleTypeListFilters,
  VehicleTypeListResult,
} from '@/types/vehicle-type';
import { http } from '../http';

export const vehicleTypesApi = {
  async list(filters: VehicleTypeListFilters): Promise<VehicleTypeListResult> {
    const response = await http.get<ApiEnvelope<VehicleType[]>>('/vehicle-types', {
      params: filters,
    });

    return {
      items: response.data.data,
      meta: (response.data.meta ?? {
        page: filters.page,
        limit: filters.limit,
        total: response.data.data.length,
        total_pages: 1,
      }) as VehicleTypeListResult['meta'],
    };
  },

  async listOptions(): Promise<VehicleType[]> {
    const response = await http.get<ApiEnvelope<VehicleType[]>>('/vehicle-types', {
      params: { limit: 100 },
    });
    return response.data.data;
  },

  async getById(id: number): Promise<VehicleType> {
    const response = await http.get<ApiEnvelope<{ loai_xe: VehicleType }>>(`/vehicle-types/${id}`);
    return response.data.data.loai_xe;
  },

  async create(input: VehicleTypeInput): Promise<VehicleType> {
    const response = await http.post<ApiEnvelope<{ loai_xe: VehicleType }>>(
      '/vehicle-types',
      input,
    );
    return response.data.data.loai_xe;
  },

  async update(id: number, input: VehicleTypeInput): Promise<VehicleType> {
    const response = await http.put<ApiEnvelope<{ loai_xe: VehicleType }>>(
      `/vehicle-types/${id}`,
      input,
    );
    return response.data.data.loai_xe;
  },

  async delete(id: number): Promise<void> {
    await http.delete(`/vehicle-types/${id}`);
  },
};
