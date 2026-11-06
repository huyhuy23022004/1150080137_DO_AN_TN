import type { ApiEnvelope } from '../../types/api';
import type {
  AuthPayload,
  ChangePasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
  UpdateProfileInput,
} from '../../types/auth';
import { sessionStorage } from '../../services/storage';
import { apiClient, MOBILE_CLIENT_HEADER, persistSessionFromHeaders } from '../client';

export const authApi = {
  async login(input: LoginInput): Promise<AuthPayload> {
    const response = await apiClient.post<ApiEnvelope<AuthPayload>>('/auth/login', input);
    const payload = response.data.data;
    await persistSessionFromHeaders(response.headers, payload.access_token, payload.refresh_token);
    return payload;
  },

  async register(input: RegisterInput): Promise<AuthPayload> {
    const response = await apiClient.post<ApiEnvelope<AuthPayload>>('/auth/register', input);
    const payload = response.data.data;
    await persistSessionFromHeaders(response.headers, payload.access_token, payload.refresh_token);
    return payload;
  },

  async getProfile(): Promise<PublicUser> {
    const response = await apiClient.get<ApiEnvelope<{ nguoi_dung: PublicUser }>>('/auth/me');
    return response.data.data.nguoi_dung;
  },

  async updateProfile(input: UpdateProfileInput): Promise<PublicUser> {
    const response = await apiClient.patch<ApiEnvelope<{ nguoi_dung: PublicUser }>>(
      '/auth/me',
      input,
    );
    return response.data.data.nguoi_dung;
  },

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await apiClient.post<ApiEnvelope<{ message: string }>>('/auth/change-password', input);
  },

  async logout(): Promise<void> {
    const [cookie, refreshToken] = await Promise.all([
      sessionStorage.getRefreshCookie(),
      sessionStorage.getRefreshToken(),
    ]);

    await apiClient.post<ApiEnvelope<{ message: string }>>(
      '/auth/logout',
      refreshToken ? { refresh_token: refreshToken } : undefined,
      {
        headers: {
          ...MOBILE_CLIENT_HEADER,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        withCredentials: true,
      },
    );
  },
};
