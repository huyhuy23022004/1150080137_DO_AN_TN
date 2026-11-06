import { Platform } from 'react-native';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

const apiBaseUrl = trimTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://${fallbackHost}:3000/api/v1`,
);

const defaultSocketUrl = apiBaseUrl.replace(/\/api\/v1$/, '');

export const env = {
  apiBaseUrl,
  socketUrl: trimTrailingSlash(process.env.EXPO_PUBLIC_SOCKET_URL ?? defaultSocketUrl),
  socketPath: ensureLeadingSlash(process.env.EXPO_PUBLIC_SOCKET_PATH ?? '/socket.io'),
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? 'FUTA Bus',
  vnpayReturnPath: ensureLeadingSlash(
    process.env.EXPO_PUBLIC_VNPAY_RETURN_PATH ?? '/payments/vnpay/return',
  ),
} as const;
