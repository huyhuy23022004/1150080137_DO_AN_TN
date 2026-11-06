import type { ApiEnvelope } from '@/types/api';
import type { AuthPayload, ChangePasswordInput, LoginInput, PublicUser } from '@/types/auth';
import { http } from '../http';

export const authApi = {
  async login(input: LoginInput): Promise<AuthPayload> {
    const response = await http.post<ApiEnvelope<AuthPayload>>('/auth/login', input);
    return response.data.data;
  },

  async logout(): Promise<void> {
    await http.post<ApiEnvelope<{ message: string }>>('/auth/logout');
  },

  async logoutAll(): Promise<void> {
    await http.post<ApiEnvelope<{ message: string }>>('/auth/logout-all');
  },

  async getProfile(): Promise<PublicUser> {
    const response = await http.get<ApiEnvelope<{ nguoi_dung: PublicUser }>>('/auth/me');
    return response.data.data.nguoi_dung;
  },

  async changePassword(input: ChangePasswordInput): Promise<string> {
    const response = await http.post<ApiEnvelope<{ message: string }>>(
      '/auth/change-password',
      input,
    );
    return response.data.data.message;
  },
};
