import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'futa.access_token';
const REFRESH_COOKIE_KEY = 'futa.refresh_cookie';
const REFRESH_TOKEN_KEY = 'futa.refresh_token';

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) {
      await SecureStore.deleteItemAsync(key);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  } catch {
    return;
  }
}

export const sessionStorage = {
  getAccessToken(): Promise<string | null> {
    return secureGet(ACCESS_TOKEN_KEY);
  },

  async setAccessToken(value: string | null): Promise<void> {
    await secureSet(ACCESS_TOKEN_KEY, value);
  },

  getRefreshCookie(): Promise<string | null> {
    return secureGet(REFRESH_COOKIE_KEY);
  },

  async setRefreshCookie(value: string | null): Promise<void> {
    await secureSet(REFRESH_COOKIE_KEY, value);
  },

  getRefreshToken(): Promise<string | null> {
    return secureGet(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(value: string | null): Promise<void> {
    await secureSet(REFRESH_TOKEN_KEY, value);
  },

  async clear(): Promise<void> {
    await Promise.all([
      secureSet(ACCESS_TOKEN_KEY, null),
      secureSet(REFRESH_COOKIE_KEY, null),
      secureSet(REFRESH_TOKEN_KEY, null),
    ]);
  },
};

export const appStorage = {
  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },

  async setJson<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      return;
    }
  },
};
