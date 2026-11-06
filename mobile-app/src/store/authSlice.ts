import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '../api/endpoints/auth';
import { clearApiSession, getAccessToken, setAccessToken } from '../api/client';
import { getErrorMessage, getFieldErrors, normalizeApiError } from '../api/errors';
import { appStorage, sessionStorage } from '../services/storage';
import type { LoginInput, PublicUser, RegisterInput, UpdateProfileInput } from '../types/auth';
import type { RootState } from './index';

const USER_CACHE_KEY = 'futa.cached_user';

type AuthStatus = 'bootstrapping' | 'guest' | 'authenticated';

interface BootstrapResult {
  user: PublicUser | null;
  warning?: string;
}

interface AuthReject {
  message: string;
  fieldErrors: Record<string, string>;
}

interface AuthState {
  status: AuthStatus;
  user: PublicUser | null;
  isSubmitting: boolean;
  isUpdatingProfile: boolean;
  isLoggingOut: boolean;
  error: string | null;
  warning: string | null;
  fieldErrors: Record<string, string>;
}

const initialState: AuthState = {
  status: 'bootstrapping',
  user: null,
  isSubmitting: false,
  isUpdatingProfile: false,
  isLoggingOut: false,
  error: null,
  warning: null,
  fieldErrors: {},
};

function toReject(error: unknown): AuthReject {
  return {
    message: getErrorMessage(error),
    fieldErrors: getFieldErrors(error),
  };
}

async function activateUser(user: PublicUser): Promise<void> {
  await appStorage.setJson(USER_CACHE_KEY, user);
}

export const bootstrapAuth = createAsyncThunk<BootstrapResult, void, { rejectValue: string }>(
  'auth/bootstrap',
  async () => {
    const token = await sessionStorage.getAccessToken();

    if (!token) {
      return { user: null };
    }

    setAccessToken(token);

    try {
      const user = await authApi.getProfile();
      await activateUser(user);
      return { user };
    } catch (error) {
      const normalized = normalizeApiError(error);

      if (
        normalized.status === 401 ||
        normalized.code === 'AUTH_REFRESH_MISSING' ||
        normalized.code === 'AUTH_TOKEN_INVALID'
      ) {
        await clearApiSession();
        await appStorage.remove(USER_CACHE_KEY);
        return { user: null };
      }

      const cached = await appStorage.getJson<PublicUser>(USER_CACHE_KEY);
      if (cached) {
        return {
          user: cached,
          warning: 'Đang dùng dữ liệu đã lưu. Một số chức năng có thể tạm thời không khả dụng.',
        };
      }

      return { user: null, warning: normalized.message };
    }
  },
);

export const login = createAsyncThunk<PublicUser, LoginInput, { rejectValue: AuthReject }>(
  'auth/login',
  async (input, { rejectWithValue }) => {
    try {
      const payload = await authApi.login(input);
      await activateUser(payload.nguoi_dung);
      return payload.nguoi_dung;
    } catch (error) {
      return rejectWithValue(toReject(error));
    }
  },
);

export const register = createAsyncThunk<PublicUser, RegisterInput, { rejectValue: AuthReject }>(
  'auth/register',
  async (input, { rejectWithValue }) => {
    try {
      const payload = await authApi.register(input);
      await activateUser(payload.nguoi_dung);
      return payload.nguoi_dung;
    } catch (error) {
      return rejectWithValue(toReject(error));
    }
  },
);

export const updateProfile = createAsyncThunk<
  PublicUser,
  UpdateProfileInput,
  { rejectValue: AuthReject }
>('auth/updateProfile', async (input, { rejectWithValue }) => {
  try {
    const user = await authApi.updateProfile(input);
    await activateUser(user);
    return user;
  } catch (error) {
    return rejectWithValue(toReject(error));
  }
});

export const logout = createAsyncThunk<void, void>('auth/logout', async () => {
  try {
    if (getAccessToken()) {
      await authApi.logout();
    }
  } catch {
    return;
  } finally {
    await clearApiSession();
    await appStorage.remove(USER_CACHE_KEY);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError(state) {
      state.error = null;
      state.fieldErrors = {};
    },
    clearAuthWarning(state) {
      state.warning = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.pending, (state) => {
        state.status = 'bootstrapping';
      })
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.status = action.payload.user ? 'authenticated' : 'guest';
        state.warning = action.payload.warning ?? null;
      })
      .addCase(bootstrapAuth.rejected, (state) => {
        state.user = null;
        state.status = 'guest';
      })
      .addCase(login.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.status = 'authenticated';
        state.user = action.payload;
        state.warning = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload?.message ?? 'Đăng nhập thất bại.';
        state.fieldErrors = action.payload?.fieldErrors ?? {};
      })
      .addCase(register.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.status = 'authenticated';
        state.user = action.payload;
        state.warning = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload?.message ?? 'Đăng ký thất bại.';
        state.fieldErrors = action.payload?.fieldErrors ?? {};
      })
      .addCase(updateProfile.pending, (state) => {
        state.isUpdatingProfile = true;
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isUpdatingProfile = false;
        state.user = action.payload;
        state.warning = null;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isUpdatingProfile = false;
        state.error = action.payload?.message ?? 'Cập nhật hồ sơ thất bại.';
        state.fieldErrors = action.payload?.fieldErrors ?? {};
      })
      .addCase(logout.pending, (state) => {
        state.isLoggingOut = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoggingOut = false;
        state.status = 'guest';
        state.user = null;
        state.error = null;
        state.warning = null;
        state.fieldErrors = {};
      })
      .addCase(logout.rejected, (state) => {
        state.isLoggingOut = false;
        state.status = 'guest';
        state.user = null;
      });
  },
});

export const { clearAuthError, clearAuthWarning } = authSlice.actions;

export const selectAuth = (state: RootState) => state.auth;
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectIsPassenger = (state: RootState) =>
  state.auth.user?.ten_vai_tro === 'KHACH_HANG';
export const selectIsDriver = (state: RootState) => state.auth.user?.ten_vai_tro === 'TAI_XE';

export default authSlice.reducer;
