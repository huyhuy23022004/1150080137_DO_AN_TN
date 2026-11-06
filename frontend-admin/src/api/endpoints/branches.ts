import type { ApiEnvelope } from '@/types/api';
import type { Branch, BranchInput, BranchListFilters, BranchListResult } from '@/types/branch';
import { http } from '../http';

export const branchesApi = {
  async list(filters: BranchListFilters): Promise<BranchListResult> {
    const response = await http.get<ApiEnvelope<Branch[]>>('/branches', {
      params: filters,
    });

    return {
      items: response.data.data,
      meta: (response.data.meta ?? {
        page: filters.page,
        limit: filters.limit,
        total: response.data.data.length,
        total_pages: 1,
      }) as BranchListResult['meta'],
    };
  },

  async listActive(): Promise<Branch[]> {
    const response = await http.get<ApiEnvelope<Branch[]>>('/branches', {
      params: {
        limit: 100,
        trang_thai_hoat_dong: 'HOAT_DONG',
      },
    });

    return response.data.data;
  },

  async getById(id: number): Promise<Branch> {
    const response = await http.get<ApiEnvelope<{ chi_nhanh: Branch }>>(`/branches/${id}`);
    return response.data.data.chi_nhanh;
  },

  async create(input: BranchInput): Promise<Branch> {
    const response = await http.post<ApiEnvelope<{ chi_nhanh: Branch }>>('/branches', input);
    return response.data.data.chi_nhanh;
  },

  async update(id: number, input: BranchInput): Promise<Branch> {
    const response = await http.put<ApiEnvelope<{ chi_nhanh: Branch }>>(`/branches/${id}`, input);
    return response.data.data.chi_nhanh;
  },

  async delete(id: number): Promise<void> {
    await http.delete(`/branches/${id}`);
  },
};
