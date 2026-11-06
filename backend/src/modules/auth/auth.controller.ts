import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { HTTP_STATUS } from '../../common/http-status';
import { asyncHandler } from '../../common/async-handler';
import { sendSuccess } from '../../common/response';
import { config } from '../../config/env';
import type {
  AuthSession,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from './auth.types';
import type { AuthService } from './auth.service';

export interface AuthController {
  register: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  logoutAll: RequestHandler;
  me: RequestHandler;
  updateProfile: RequestHandler;
  changePassword: RequestHandler;
}

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: config.cookie.path,
    maxAge: config.cookie.maxAgeMs,
    ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
  };
}

function refreshCookieClearOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: config.cookie.path,
    ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
  };
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(config.cookie.name, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(config.cookie.name, refreshCookieClearOptions());
}

function bodyRefreshToken(req: Request): string | undefined {
  const body = req.body as { refresh_token?: unknown } | undefined;
  const value = body?.refresh_token;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readRefreshToken(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const cookieValue = cookies?.[config.cookie.name];
  if (typeof cookieValue === 'string' && cookieValue) {
    return cookieValue;
  }

  return bodyRefreshToken(req);
}

function isMobileClient(req: Request): boolean {
  return req.header('X-Client-Type')?.toLowerCase() === 'mobile';
}

function authPayload(session: AuthSession, includeRefreshToken: boolean): Record<string, unknown> {
  return {
    access_token: session.access_token,
    token_type: 'Bearer',
    expires_in: session.expires_in,
    ...(includeRefreshToken ? { refresh_token: session.refresh_token } : {}),
    nguoi_dung: session.user,
  };
}

function requireUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.AUTH_TOKEN_MISSING,
      'Bạn cần đăng nhập để thực hiện thao tác này',
    );
  }

  return req.user;
}

export function createAuthController(service: AuthService): AuthController {
  return {
    register: asyncHandler(async (req, res) => {
      const body = req.body as RegisterInput;
      const session = await service.register(body);
      setRefreshCookie(res, session.refresh_token);
      sendSuccess(res, authPayload(session, isMobileClient(req)), HTTP_STATUS.CREATED);
    }),

    login: asyncHandler(async (req, res) => {
      const body = req.body as LoginInput;
      const session = await service.login(body);
      setRefreshCookie(res, session.refresh_token);
      sendSuccess(res, authPayload(session, isMobileClient(req)));
    }),

    refresh: asyncHandler(async (req, res) => {
      const refreshToken = readRefreshToken(req);

      if (!refreshToken) {
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.AUTH_REFRESH_INVALID,
          'Không tìm thấy refresh token',
        );
      }

      const session = await service.refresh(refreshToken);
      setRefreshCookie(res, session.refresh_token);
      sendSuccess(
        res,
        authPayload(session, isMobileClient(req) || bodyRefreshToken(req) !== undefined),
      );
    }),

    logout: asyncHandler(async (req, res) => {
      const refreshToken = readRefreshToken(req);
      await service.logout(refreshToken);
      clearRefreshCookie(res);
      sendSuccess(res, { message: 'Đăng xuất thành công' });
    }),

    logoutAll: asyncHandler(async (req, res) => {
      const user = requireUser(req);
      await service.logoutAll(user.ma_nguoi_dung);
      clearRefreshCookie(res);
      sendSuccess(res, { message: 'Đã đăng xuất khỏi tất cả thiết bị' });
    }),

    me: asyncHandler(async (req, res) => {
      const user = requireUser(req);
      const profile = await service.getProfile(user.ma_nguoi_dung);
      sendSuccess(res, { nguoi_dung: profile });
    }),

    updateProfile: asyncHandler(async (req, res) => {
      const user = requireUser(req);
      const body = req.body as UpdateProfileInput;
      const profile = await service.updateProfile(user.ma_nguoi_dung, body);
      sendSuccess(res, { nguoi_dung: profile });
    }),

    changePassword: asyncHandler(async (req, res) => {
      const user = requireUser(req);
      const body = req.body as ChangePasswordInput;
      await service.changePassword(user.ma_nguoi_dung, body);
      clearRefreshCookie(res);
      sendSuccess(res, {
        message: 'Đổi mật khẩu thành công, vui lòng đăng nhập lại trên tất cả thiết bị',
      });
    }),
  };
}
