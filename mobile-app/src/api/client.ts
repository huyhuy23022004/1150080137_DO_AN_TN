import {
  create,
  isAxiosError,
  type AxiosResponseHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '../config/env';
import { sessionStorage } from '../services/storage';
import type { ApiEnvelope } from '../types/api';
import type { AuthPayload } from '../types/auth';
import { normalizeApiError } from './errors';

export const REFRESH_COOKIE_NAME = 'futa_refresh_token';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export const MOBILE_CLIENT_HEADER = {
  'X-Client-Type': 'mobile',
} as const;

export const apiClient = create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...MOBILE_CLIENT_HEADER,
  },
});

const refreshClient = create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...MOBILE_CLIENT_HEADER,
  },
});

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(value: string | null): void {
  accessToken = value;
}

export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null): void {
  unauthorizedHandler = handler;
}

function headerValues(headers: AxiosResponseHeaders | Record<string, unknown>, name: string) {
  const record = headers as Record<string, unknown>;
  const key = Object.keys(record).find((entry) => entry.toLowerCase() === name.toLowerCase());
  const raw = key ? record[key] : undefined;

  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }

  return typeof raw === 'string' ? [raw] : [];
}

export function extractRefreshCookie(
  headers: AxiosResponseHeaders | Record<string, unknown> | undefined,
): string | null {
  if (!headers) {
    return null;
  }

  for (const line of headerValues(headers, 'set-cookie')) {
    const match = new RegExp(`${REFRESH_COOKIE_NAME}=([^;,\\s]+)`).exec(line);
    if (match?.[1]) {
      return `${REFRESH_COOKIE_NAME}=${match[1]}`;
    }
  }

  return null;
}

export async function persistSessionFromHeaders(
  headers: AxiosResponseHeaders | Record<string, unknown> | undefined,
  token: string,
  refreshToken?: string,
): Promise<void> {
  const cookie = extractRefreshCookie(headers);
  accessToken = token;

  await Promise.all([
    sessionStorage.setAccessToken(token),
    refreshToken
      ? sessionStorage.setRefreshToken(refreshToken)
      : sessionStorage.setRefreshToken(null),
    cookie ? sessionStorage.setRefreshCookie(cookie) : Promise.resolve(),
  ]);
}

export async function clearApiSession(): Promise<void> {
  accessToken = null;
  await sessionStorage.clear();
}

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  return ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].some((path) =>
    url.includes(path),
  );
}

async function performRefresh(): Promise<string> {
  const [cookie, refreshToken] = await Promise.all([
    sessionStorage.getRefreshCookie(),
    sessionStorage.getRefreshToken(),
  ]);
  const response = await refreshClient.post<ApiEnvelope<AuthPayload>>(
    '/auth/refresh',
    refreshToken ? { refresh_token: refreshToken } : undefined,
    {
      headers: cookie ? { Cookie: cookie } : {},
      withCredentials: true,
    },
  );

  const payload = response.data.data;
  await persistSessionFromHeaders(response.headers, payload.access_token, payload.refresh_token);
  return payload.access_token;
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error)) {
      return Promise.reject(normalizeApiError(error));
    }

    const config = error.config as RetryConfig | undefined;
    if (error.response?.status !== 401 || !config || config._retry || isAuthEndpoint(config.url)) {
      return Promise.reject(normalizeApiError(error));
    }

    config._retry = true;

    try {
      const token = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return apiClient(config);
    } catch (refreshError) {
      accessToken = null;
      await sessionStorage.clear();
      await unauthorizedHandler?.();
      return Promise.reject(normalizeApiError(refreshError));
    }
  },
);
