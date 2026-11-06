import { randomUUID } from 'node:crypto';
import { ROLES } from '../../common/constants';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { getDuplicateField, isDuplicateEntryError } from '../../common/errors/db-errors';
import { HTTP_STATUS } from '../../common/http-status';
import { logger } from '../../config/logger';
import { isValidVietnamesePhone, normalizeVietnamesePhone } from '../../utils/phone';
import { PasswordService } from '../../utils/password';
import { hashToken } from '../../utils/token-hash';
import type {
  AuthRepositoryPort,
  AuthSession,
  AuthUserRecord,
  ChangePasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
  UpdateProfileInput,
} from './auth.types';
import type { LoginAttemptTracker } from './login-attempt.tracker';
import type { RefreshTokenStore } from './refresh-token.store';
import { TokenService } from './token.service';

export interface AuthServiceDependencies {
  repository: AuthRepositoryPort;
  refreshTokenStore: RefreshTokenStore;
  loginAttemptTracker: LoginAttemptTracker;
  tokenService: TokenService;
  passwordService: PasswordService;
  refreshTtlSeconds: number;
}

function invalidCredentials(): AppError {
  return new AppError(
    HTTP_STATUS.UNAUTHORIZED,
    ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    'Số điện thoại hoặc mật khẩu không đúng',
  );
}

export class AuthService {
  public constructor(private readonly dependencies: AuthServiceDependencies) {}

  public async register(input: RegisterInput): Promise<AuthSession> {
    const repository = this.dependencies.repository;
    const phone = normalizeVietnamesePhone(input.so_dien_thoai);
    const email = input.email?.trim().toLowerCase() || null;

    const role = await repository.findRoleByName(ROLES.KHACH_HANG);
    if (!role) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.AUTH_ROLE_NOT_FOUND,
        'Không tìm thấy vai trò KHACH_HANG trong hệ thống',
      );
    }

    if (await repository.phoneExists(phone)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.AUTH_PHONE_EXISTS,
        'Số điện thoại đã được đăng ký',
      );
    }

    if (email && (await repository.emailExists(email))) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.AUTH_EMAIL_EXISTS,
        'Email đã được đăng ký',
      );
    }

    const passwordHash = await this.dependencies.passwordService.hash(input.mat_khau);

    let userId: string;
    try {
      userId = await repository.createUser({
        ma_vai_tro: role.ma_vai_tro,
        ma_chi_nhanh: null,
        ho_va_ten: input.ho_va_ten.trim(),
        so_dien_thoai: phone,
        email,
        mat_khau_ma_hoa: passwordHash,
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        const field = getDuplicateField(error);

        if (field === 'email') {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.AUTH_EMAIL_EXISTS,
            'Email đã được đăng ký',
          );
        }

        throw new AppError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.AUTH_PHONE_EXISTS,
          'Số điện thoại đã được đăng ký',
        );
      }

      throw error;
    }

    const user = await repository.findUserById(userId);
    if (!user) {
      throw new Error('User was created but could not be reloaded');
    }

    return this.issueSession(user);
  }

  public async login(input: LoginInput): Promise<AuthSession> {
    const repository = this.dependencies.repository;
    const tracker = this.dependencies.loginAttemptTracker;
    const phone = normalizeVietnamesePhone(input.so_dien_thoai);

    if (await tracker.isLocked(phone)) {
      throw new AppError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        ERROR_CODES.AUTH_ACCOUNT_LOCKED,
        'Tài khoản tạm thời bị khóa do đăng nhập sai quá nhiều lần',
      );
    }

    const user = await repository.findUserByPhone(phone);

    if (!user) {
      const dummyHash = await this.dependencies.passwordService.getDummyHash();
      await this.dependencies.passwordService.verify(input.mat_khau, dummyHash);
      await tracker.recordFailure(phone);
      throw invalidCredentials();
    }

    const passwordMatches = await this.dependencies.passwordService.verify(
      input.mat_khau,
      user.mat_khau_ma_hoa,
    );

    if (!passwordMatches) {
      await tracker.recordFailure(phone);
      throw invalidCredentials();
    }

    if (user.trang_thai_tai_khoan !== 'HOAT_DONG') {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.AUTH_ACCOUNT_DISABLED,
        'Tài khoản đã bị khóa',
      );
    }

    await tracker.reset(phone);
    return this.issueSession(user);
  }

  public async refresh(refreshToken: string): Promise<AuthSession> {
    const tokenService = this.dependencies.tokenService;
    const store = this.dependencies.refreshTokenStore;
    const claims = tokenService.verifyRefreshToken(refreshToken);
    const consumeResult = await store.consume(claims.sub, claims.jti, hashToken(refreshToken));

    if (consumeResult === 'REUSED') {
      await this.safeRevokeAll(claims.sub);
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.AUTH_REFRESH_REUSED,
        'Refresh token đã được sử dụng hoặc không còn hợp lệ',
      );
    }

    if (consumeResult === 'MISSING') {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = await this.dependencies.repository.findUserById(claims.sub);

    if (!user) {
      await this.safeRevokeAll(claims.sub);
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.AUTH_USER_NOT_FOUND,
        'Không tìm thấy người dùng',
      );
    }

    if (user.trang_thai_tai_khoan !== 'HOAT_DONG') {
      await this.safeRevokeAll(user.ma_nguoi_dung);
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.AUTH_ACCOUNT_DISABLED,
        'Tài khoản đã bị khóa',
      );
    }

    return this.issueSession(user);
  }

  public async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const claims = this.dependencies.tokenService.verifyRefreshToken(refreshToken);
      const result = await this.dependencies.refreshTokenStore.consume(
        claims.sub,
        claims.jti,
        hashToken(refreshToken),
      );

      if (result === 'REUSED') {
        await this.dependencies.refreshTokenStore.revokeAll(claims.sub);
        return;
      }

      if (result === 'OK') {
        await this.dependencies.refreshTokenStore.revoke(claims.sub, claims.jti);
      }
    } catch (error) {
      logger.warn({ err: error }, 'logout_refresh_token_not_revoked');
    }
  }

  public async logoutAll(userId: string): Promise<void> {
    await this.dependencies.refreshTokenStore.revokeAll(userId);
  }

  public async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.dependencies.repository.findUserById(userId);

    if (!user) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.AUTH_USER_NOT_FOUND,
        'Không tìm thấy người dùng',
      );
    }

    const currentPasswordMatches = await this.dependencies.passwordService.verify(
      input.mat_khau_cu,
      user.mat_khau_ma_hoa,
    );

    if (!currentPasswordMatches) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.AUTH_PASSWORD_MISMATCH,
        'Mật khẩu hiện tại không đúng',
      );
    }

    const newPasswordIsSame = await this.dependencies.passwordService.verify(
      input.mat_khau_moi,
      user.mat_khau_ma_hoa,
    );

    if (newPasswordIsSame) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Mật khẩu mới phải khác mật khẩu hiện tại',
      );
    }

    const passwordHash = await this.dependencies.passwordService.hash(input.mat_khau_moi);
    await this.dependencies.repository.updatePassword(userId, passwordHash);
    await this.dependencies.refreshTokenStore.revokeAll(userId);
  }

  public async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    const repository = this.dependencies.repository;
    const user = await repository.findUserById(userId);

    if (!user) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.AUTH_USER_NOT_FOUND,
        'Không tìm thấy người dùng',
      );
    }

    if (user.trang_thai_tai_khoan !== 'HOAT_DONG') {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.AUTH_ACCOUNT_DISABLED,
        'Tài khoản đã bị khóa',
      );
    }

    const hasName = input.ho_va_ten !== undefined;
    const hasPhone = input.so_dien_thoai !== undefined;
    const hasEmail = input.email !== undefined;

    if (!hasName && !hasPhone && !hasEmail) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Cần cung cấp ít nhất một thông tin cần cập nhật',
      );
    }

    const name = hasName ? (input.ho_va_ten?.trim() ?? '') : user.ho_va_ten;
    if (name.length < 2 || name.length > 100) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Họ và tên phải có từ 2 đến 100 ký tự',
      );
    }

    const phone = hasPhone
      ? normalizeVietnamesePhone(input.so_dien_thoai ?? '')
      : user.so_dien_thoai;
    if (!isValidVietnamesePhone(phone)) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Số điện thoại không hợp lệ',
      );
    }

    const email = hasEmail ? input.email?.trim().toLowerCase() || null : user.email;

    if (phone !== user.so_dien_thoai && (await repository.phoneExists(phone, userId))) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.AUTH_PHONE_EXISTS,
        'Số điện thoại đã được đăng ký',
      );
    }

    if (email && email !== user.email && (await repository.emailExists(email, userId))) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.AUTH_EMAIL_EXISTS,
        'Email đã được đăng ký',
      );
    }

    try {
      await repository.updateProfile(userId, {
        ho_va_ten: name,
        so_dien_thoai: phone,
        email,
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        const field = getDuplicateField(error);
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          field === 'email' ? ERROR_CODES.AUTH_EMAIL_EXISTS : ERROR_CODES.AUTH_PHONE_EXISTS,
          field === 'email' ? 'Email đã được đăng ký' : 'Số điện thoại đã được đăng ký',
        );
      }

      throw error;
    }

    const updated = await repository.findUserById(userId);
    if (!updated) {
      throw new Error('User was updated but could not be reloaded');
    }

    return this.toPublicUser(updated);
  }
  public async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.dependencies.repository.findUserById(userId);

    if (!user) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.AUTH_USER_NOT_FOUND,
        'Không tìm thấy người dùng',
      );
    }

    if (user.trang_thai_tai_khoan !== 'HOAT_DONG') {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.AUTH_ACCOUNT_DISABLED,
        'Tài khoản đã bị khóa',
      );
    }

    return this.toPublicUser(user);
  }

  private async issueSession(user: AuthUserRecord): Promise<AuthSession> {
    const tokenService = this.dependencies.tokenService;
    const jti = randomUUID();
    const accessToken = tokenService.signAccessToken(user);
    const refreshToken = tokenService.signRefreshToken(user.ma_nguoi_dung, jti);

    await this.dependencies.refreshTokenStore.save(
      user.ma_nguoi_dung,
      jti,
      hashToken(refreshToken),
      this.dependencies.refreshTtlSeconds,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.dependencies.tokenService.accessTtlSeconds,
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: AuthUserRecord): PublicUser {
    return {
      ma_nguoi_dung: user.ma_nguoi_dung,
      ho_va_ten: user.ho_va_ten,
      so_dien_thoai: user.so_dien_thoai,
      email: user.email,
      ma_chi_nhanh: user.ma_chi_nhanh,
      ten_vai_tro: user.ten_vai_tro,
      trang_thai_tai_khoan: user.trang_thai_tai_khoan,
      thoi_gian_tao: user.thoi_gian_tao,
    };
  }

  private async safeRevokeAll(userId: string): Promise<void> {
    try {
      await this.dependencies.refreshTokenStore.revokeAll(userId);
    } catch (error) {
      logger.error({ err: error, userId }, 'failed_to_revoke_all_refresh_tokens');
    }
  }
}
