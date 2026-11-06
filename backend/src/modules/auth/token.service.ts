import jwt, { JsonWebTokenError, TokenExpiredError, type JwtPayload } from 'jsonwebtoken';
import { isRoleName, TOKEN_TYPE, type RoleName } from '../../common/constants';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { HTTP_STATUS } from '../../common/http-status';
import type { AuthUserRecord } from './auth.types';

export interface TokenSettings {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  issuer: string;
  audience: string;
}

export interface AccessTokenClaims extends JwtPayload {
  sub: string;
  type: typeof TOKEN_TYPE.ACCESS;
  ten_vai_tro: RoleName;
  ma_chi_nhanh: number | null;
  ho_va_ten: string;
}

export interface RefreshTokenClaims extends JwtPayload {
  sub: string;
  type: typeof TOKEN_TYPE.REFRESH;
  jti: string;
}

function invalidToken(): AppError {
  return new AppError(
    HTTP_STATUS.UNAUTHORIZED,
    ERROR_CODES.AUTH_TOKEN_INVALID,
    'Token không hợp lệ',
  );
}

function mapJwtError(error: unknown): never {
  if (error instanceof TokenExpiredError) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.AUTH_TOKEN_EXPIRED,
      'Token đã hết hạn',
    );
  }

  if (error instanceof JsonWebTokenError || error instanceof Error) {
    throw invalidToken();
  }

  throw invalidToken();
}

export class TokenService {
  public constructor(private readonly settings: TokenSettings) {}

  public get accessTtlSeconds(): number {
    return this.settings.accessTtlSeconds;
  }

  public signAccessToken(user: AuthUserRecord): string {
    return jwt.sign(
      {
        type: TOKEN_TYPE.ACCESS,
        ten_vai_tro: user.ten_vai_tro,
        ma_chi_nhanh: user.ma_chi_nhanh,
        ho_va_ten: user.ho_va_ten,
      },
      this.settings.accessSecret,
      {
        subject: user.ma_nguoi_dung,
        issuer: this.settings.issuer,
        audience: this.settings.audience,
        expiresIn: this.settings.accessTtlSeconds,
        algorithm: 'HS256',
      },
    );
  }

  public signRefreshToken(userId: string, jti: string): string {
    return jwt.sign({ type: TOKEN_TYPE.REFRESH }, this.settings.refreshSecret, {
      subject: userId,
      jwtid: jti,
      issuer: this.settings.issuer,
      audience: this.settings.audience,
      expiresIn: this.settings.refreshTtlSeconds,
      algorithm: 'HS256',
    });
  }

  public verifyAccessToken(token: string): AccessTokenClaims {
    let payload: string | JwtPayload;

    try {
      payload = jwt.verify(token, this.settings.accessSecret, {
        algorithms: ['HS256'],
        issuer: this.settings.issuer,
        audience: this.settings.audience,
      });
    } catch (error) {
      mapJwtError(error);
    }

    if (typeof payload === 'string' || payload.type !== TOKEN_TYPE.ACCESS) {
      throw invalidToken();
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.ho_va_ten !== 'string' ||
      typeof payload.ten_vai_tro !== 'string' ||
      !isRoleName(payload.ten_vai_tro) ||
      (payload.ma_chi_nhanh !== null && typeof payload.ma_chi_nhanh !== 'number')
    ) {
      throw invalidToken();
    }

    return payload as AccessTokenClaims;
  }

  public verifyRefreshToken(token: string): RefreshTokenClaims {
    let payload: string | JwtPayload;

    try {
      payload = jwt.verify(token, this.settings.refreshSecret, {
        algorithms: ['HS256'],
        issuer: this.settings.issuer,
        audience: this.settings.audience,
      });
    } catch (error) {
      mapJwtError(error);
    }

    if (
      typeof payload === 'string' ||
      payload.type !== TOKEN_TYPE.REFRESH ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.AUTH_REFRESH_INVALID,
        'Refresh token không hợp lệ',
      );
    }

    return payload as RefreshTokenClaims;
  }
}
