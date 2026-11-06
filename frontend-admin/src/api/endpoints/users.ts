import type { ApiEnvelope } from '@/types/api';
import type {
  CreateUserInput,
  RoleOption,
  UpdateUserInput,
  UserListFilters,
  UserListResult,
  UserRecord,
} from '@/types/user';
import { http } from '../http';

export const usersApi = {
  async list(filters: UserListFilters): Promise<UserListResult> {
    const response = await http.get<ApiEnvelope<UserRecord[]>>('/users', { params: filters });

    return {
      items: response.data.data,
      meta: (response.data.meta ?? {
        page: filters.page,
        limit: filters.limit,
        total: response.data.data.length,
        total_pages: 1,
      }) as UserListResult['meta'],
    };
  },

  async listRoles(): Promise<RoleOption[]> {
    const response = await http.get<ApiEnvelope<RoleOption[]>>('/users/roles');
    return response.data.data;
  },

  async getById(id: string): Promise<UserRecord> {
    const response = await http.get<ApiEnvelope<{ nguoi_dung: UserRecord }>>(`/users/${id}`);
    return response.data.data.nguoi_dung;
  },

  async create(input: CreateUserInput): Promise<UserRecord> {
    const response = await http.post<ApiEnvelope<{ nguoi_dung: UserRecord }>>('/users', input);
    return response.data.data.nguoi_dung;
  },

  async update(id: string, input: UpdateUserInput): Promise<UserRecord> {
    const response = await http.put<ApiEnvelope<{ nguoi_dung: UserRecord }>>(`/users/${id}`, input);
    return response.data.data.nguoi_dung;
  },

  async changeStatus(id: string, trang_thai_tai_khoan: string): Promise<UserRecord> {
    const response = await http.patch<ApiEnvelope<{ nguoi_dung: UserRecord }>>(
      `/users/${id}/status`,
      { trang_thai_tai_khoan },
    );
    return response.data.data.nguoi_dung;
  },

  async resetPassword(id: string, mat_khau_moi: string): Promise<string> {
    const response = await http.post<ApiEnvelope<{ message: string }>>(
      `/users/${id}/reset-password`,
      { mat_khau_moi },
    );
    return response.data.data.message;
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/users/${id}`);
  },
};
