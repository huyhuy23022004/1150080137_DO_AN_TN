import authReducer, {
  bootstrapAuth,
  login,
  logout,
  register,
  updateProfile,
} from '../../src/store/authSlice';
import type {
  LoginInput,
  PublicUser,
  RegisterInput,
  UpdateProfileInput,
} from '../../src/types/auth';

const passenger: PublicUser = {
  ma_nguoi_dung: 'ND001',
  ho_va_ten: 'Nguyễn Văn An',
  so_dien_thoai: '0901234567',
  email: 'an@example.com',
  ma_chi_nhanh: null,
  ten_vai_tro: 'KHACH_HANG',
  trang_thai_tai_khoan: 'HOAT_DONG',
  thoi_gian_tao: '2026-10-24T00:00:00.000Z',
};

const driver: PublicUser = {
  ...passenger,
  ma_nguoi_dung: 'ND002',
  ho_va_ten: 'Trần Văn Bình',
  so_dien_thoai: '0907654321',
  email: null,
  ten_vai_tro: 'TAI_XE',
};

const loginInput: LoginInput = {
  so_dien_thoai: '0901234567',
  mat_khau: '12345678',
};

const registerInput: RegisterInput = {
  ho_va_ten: 'Nguyễn Văn An',
  so_dien_thoai: '0901234567',
  email: 'an@example.com',
  mat_khau: '12345678',
  xac_nhan_mat_khau: '12345678',
};

describe('auth slice', () => {
  it('starts in the bootstrapping state', () => {
    const state = authReducer(undefined, { type: 'unknown' });

    expect(state.status).toBe('bootstrapping');
    expect(state.user).toBeNull();
  });

  it('restores a cached user during bootstrap', () => {
    const state = authReducer(
      undefined,
      bootstrapAuth.fulfilled({ user: passenger, warning: 'offline' }, 'request-1'),
    );

    expect(state.status).toBe('authenticated');
    expect(state.user?.ma_nguoi_dung).toBe('ND001');
    expect(state.warning).toBe('offline');
  });

  it('becomes a guest when bootstrap finds no session', () => {
    const state = authReducer(undefined, bootstrapAuth.fulfilled({ user: null }, 'request-1'));

    expect(state.status).toBe('guest');
    expect(state.user).toBeNull();
  });

  it('authenticates a passenger after login', () => {
    const state = authReducer(undefined, login.fulfilled(passenger, 'request-1', loginInput));

    expect(state.status).toBe('authenticated');
    expect(state.user?.ten_vai_tro).toBe('KHACH_HANG');
    expect(state.isSubmitting).toBe(false);
  });

  it('stores server validation errors after a rejected login', () => {
    const state = authReducer(
      undefined,
      login.rejected(null, 'request-1', loginInput, {
        message: 'Số điện thoại hoặc mật khẩu không đúng',
        fieldErrors: { mat_khau: 'Mật khẩu không đúng' },
      }),
    );

    expect(state.status).toBe('bootstrapping');
    expect(state.error).toBe('Số điện thoại hoặc mật khẩu không đúng');
    expect(state.fieldErrors.mat_khau).toBe('Mật khẩu không đúng');
  });

  it('authenticates a driver after registration', () => {
    const state = authReducer(undefined, register.fulfilled(driver, 'request-1', registerInput));

    expect(state.status).toBe('authenticated');
    expect(state.user?.ten_vai_tro).toBe('TAI_XE');
  });

  it('updates the cached user after a profile change', () => {
    const authenticated = authReducer(
      undefined,
      login.fulfilled(passenger, 'request-1', loginInput),
    );
    const input: UpdateProfileInput = {
      ho_va_ten: 'Nguyễn Văn An (mới)',
      so_dien_thoai: '0912345678',
      email: 'moi@example.com',
    };
    const updated: PublicUser = {
      ...passenger,
      ho_va_ten: 'Nguyễn Văn An (mới)',
      so_dien_thoai: '0912345678',
      email: 'moi@example.com',
    };

    const state = authReducer(authenticated, updateProfile.fulfilled(updated, 'request-2', input));

    expect(state.isUpdatingProfile).toBe(false);
    expect(state.user?.ho_va_ten).toBe('Nguyễn Văn An (mới)');
    expect(state.user?.so_dien_thoai).toBe('0912345678');
    expect(state.user?.email).toBe('moi@example.com');
  });

  it('stores field errors when a profile update is rejected', () => {
    const input: UpdateProfileInput = { so_dien_thoai: '0907654321' };
    const state = authReducer(
      undefined,
      updateProfile.rejected(null, 'request-2', input, {
        message: 'Số điện thoại đã được sử dụng',
        fieldErrors: { so_dien_thoai: 'Số điện thoại đã được sử dụng' },
      }),
    );

    expect(state.isUpdatingProfile).toBe(false);
    expect(state.error).toBe('Số điện thoại đã được sử dụng');
    expect(state.fieldErrors.so_dien_thoai).toBe('Số điện thoại đã được sử dụng');
  });

  it('clears the session after logout', () => {
    const authenticated = authReducer(
      undefined,
      login.fulfilled(passenger, 'request-1', loginInput),
    );
    const state = authReducer(authenticated, logout.fulfilled(undefined, 'request-2'));

    expect(state.status).toBe('guest');
    expect(state.user).toBeNull();
    expect(state.error).toBeNull();
  });
});
