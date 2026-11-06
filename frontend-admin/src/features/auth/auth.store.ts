import { create } from 'zustand';
import { authApi } from '@/api/endpoints/auth';
import { refreshSession } from '@/api/http';
import { registerUnauthorizedHandler, setAccessToken } from '@/api/token';
import { isAdminRole } from '@/lib/roles';
import type { AdminUser, AuthPayload, LoginInput, PublicUser } from '@/types/auth';

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'guest';

interface AuthState {
  status: AuthStatus;
  user: AdminUser | null;
  login: (input: LoginInput) => Promise<void>;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  setSession: (payload: AuthPayload) => void;
  clearSession: () => void;
}

let bootstrapPromise: Promise<void> | null = null;

function toAdminUser(user: PublicUser): AdminUser {
  if (!isAdminRole(user.ten_vai_tro)) {
    throw new Error('Tài khoản không có quyền truy cập trang quản trị');
  }

  return {
    ...user,
    ten_vai_tro: user.ten_vai_tro,
  };
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'bootstrapping',
  user: null,

  setSession: (payload) => {
    const user = toAdminUser(payload.nguoi_dung);
    setAccessToken(payload.access_token);
    set({ status: 'authenticated', user });
  },

  clearSession: () => {
    setAccessToken(null);
    set({ status: 'guest', user: null });
  },

  login: async (input) => {
    const payload = await authApi.login(input);

    if (!isAdminRole(payload.nguoi_dung.ten_vai_tro)) {
      await authApi.logout().catch(() => undefined);
      throw new Error('Tài khoản không có quyền truy cập trang quản trị');
    }

    get().setSession(payload);
  },

  bootstrap: () => {
    if (bootstrapPromise) {
      return bootstrapPromise;
    }

    bootstrapPromise = (async () => {
      try {
        const payload = await refreshSession();

        if (!isAdminRole(payload.nguoi_dung.ten_vai_tro)) {
          await authApi.logout().catch(() => undefined);
          get().clearSession();
          return;
        }

        get().setSession(payload);
      } catch {
        get().clearSession();
      }
    })();

    return bootstrapPromise;
  },

  logout: async () => {
    await authApi.logout().catch(() => undefined);
    get().clearSession();
  },

  logoutAll: async () => {
    await authApi.logoutAll().catch(() => undefined);
    get().clearSession();
  },
}));

registerUnauthorizedHandler(() => {
  useAuthStore.getState().clearSession();
});
