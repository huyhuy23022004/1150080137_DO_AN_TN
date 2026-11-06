import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { ApiEnvelope, ApiErrorEnvelope } from '@/types/api';
import type { AuthPayload } from '@/types/auth';
import { getAccessToken, notifyUnauthorized, setAccessToken } from './token';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

const AUTH_ENDPOINTS_WITHOUT_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh'];

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export class ApiError extends Error {
  readonly status: number | undefined;
  readonly code: string;
  readonly details: unknown;
  readonly traceId: string | undefined;

  constructor(
    message: string,
    status?: number,
    code = 'UNKNOWN_ERROR',
    details?: unknown,
    traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.traceId = traceId;
  }
}

export const http = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30_000,
});

let refreshPromise: Promise<AuthPayload> | null = null;

function isAuthEndpoint(url: string | undefined): boolean {
  return AUTH_ENDPOINTS_WITHOUT_REFRESH.some((endpoint) => url?.includes(endpoint));
}

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  return envelope.data;
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorEnvelope>(error)) {
    const response = error.response;
    const body = response?.data;

    if (body && typeof body.message === 'string') {
      return new ApiError(body.message, response?.status, body.code, body.details, body.trace_id);
    }

    if (error.code === 'ECONNABORTED') {
      return new ApiError('Yêu cầu quá thời gian chờ, vui lòng thử lại', undefined, 'TIMEOUT');
    }

    if (!response) {
      return new ApiError(
        'Không thể kết nối đến máy chủ, vui lòng kiểm tra kết nối mạng',
        undefined,
        'NETWORK_ERROR',
      );
    }

    return new ApiError('Đã có lỗi xảy ra, vui lòng thử lại', response.status, 'HTTP_ERROR');
  }

  if (error instanceof Error) {
    return new ApiError(error.message);
  }

  return new ApiError('Đã có lỗi xảy ra, vui lòng thử lại');
}

export function refreshSession(): Promise<AuthPayload> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const promise = refreshClient
    .post<ApiEnvelope<AuthPayload>>('/auth/refresh')
    .then((response) => {
      const payload = unwrap(response.data);
      setAccessToken(payload.access_token);
      return payload;
    })
    .catch((error: unknown) => {
      setAccessToken(null);
      notifyUnauthorized();
      throw normalizeApiError(error);
    });

  refreshPromise = promise;

  promise.then(
    () => {
      if (refreshPromise === promise) {
        refreshPromise = null;
      }
    },
    () => {
      if (refreshPromise === promise) {
        refreshPromise = null;
      }
    },
  );

  return promise;
}

http.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const original = error.config as RetryableRequestConfig | undefined;

      if (
        error.response?.status === 401 &&
        original &&
        !original._retry &&
        !isAuthEndpoint(original.url)
      ) {
        original._retry = true;

        try {
          const session = await refreshSession();
          original.headers.set('Authorization', `Bearer ${session.access_token}`);
          return http(original);
        } catch (refreshError) {
          return Promise.reject(normalizeApiError(refreshError));
        }
      }
    }

    return Promise.reject(normalizeApiError(error));
  },
);
