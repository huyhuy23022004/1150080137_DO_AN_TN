import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/common/errors/AppError';
import { ROLES } from '../../src/common/constants';
import { TokenService } from '../../src/modules/auth/token.service';
import type { AuthUserRecord } from '../../src/modules/auth/auth.types';
import { TEST_TOKEN_SETTINGS } from '../helpers/build-test-auth';

const user: AuthUserRecord = {
  ma_nguoi_dung: '1',
  ma_vai_tro: 6,
  ma_chi_nhanh: null,
  ho_va_ten: 'Nguyễn Văn A',
  so_dien_thoai: '0901234567',
  email: 'a@example.com',
  mat_khau_ma_hoa: 'hash',
  trang_thai_tai_khoan: 'HOAT_DONG',
  thoi_gian_tao: '2026-01-01T00:00:00.000Z',
  ten_vai_tro: ROLES.KHACH_HANG,
};

function expectAppError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('Expected AppError to be thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
  }
}

describe('TokenService', () => {
  const tokenService = new TokenService(TEST_TOKEN_SETTINGS);

  it('signs and verifies an access token', () => {
    const token = tokenService.signAccessToken(user);
    const claims = tokenService.verifyAccessToken(token);

    expect(claims.sub).toBe('1');
    expect(claims.ten_vai_tro).toBe(ROLES.KHACH_HANG);
    expect(claims.ho_va_ten).toBe('Nguyễn Văn A');
    expect(claims.ma_chi_nhanh).toBeNull();
  });

  it('signs and verifies a refresh token with jti', () => {
    const token = tokenService.signRefreshToken('1', 'refresh-jti');
    const claims = tokenService.verifyRefreshToken(token);

    expect(claims.sub).toBe('1');
    expect(claims.jti).toBe('refresh-jti');
  });

  it('rejects a tampered token', () => {
    const token = tokenService.signAccessToken(user);

    expectAppError(() => tokenService.verifyAccessToken(`${token}tampered`), 'AUTH_TOKEN_INVALID');
  });

  it('rejects a refresh token used as access token', () => {
    const token = tokenService.signRefreshToken('1', 'refresh-jti');

    expectAppError(() => tokenService.verifyAccessToken(token), 'AUTH_TOKEN_INVALID');
  });

  it('rejects a token signed with a different secret', () => {
    const otherService = new TokenService({
      ...TEST_TOKEN_SETTINGS,
      accessSecret: 'another_access_secret_at_least_32_characters',
    });
    const token = otherService.signAccessToken(user);

    expectAppError(() => tokenService.verifyAccessToken(token), 'AUTH_TOKEN_INVALID');
  });
});
