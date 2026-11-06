import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/AppError';
import { ERROR_CODES } from '../common/errors/error-codes';
import { HTTP_STATUS } from '../common/http-status';
import type { TokenService } from '../modules/auth/token.service';

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

export function createAuthMiddleware(tokenService: TokenService): RequestHandler {
  return (req, _res, next) => {
    try {
      const authorization = req.headers.authorization;

      if (!authorization) {
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.AUTH_TOKEN_MISSING,
          'Bạn cần đăng nhập để thực hiện thao tác này',
        );
      }

      const match = BEARER_PATTERN.exec(authorization);
      const token = match?.[1];

      if (!token) {
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.AUTH_TOKEN_MISSING,
          'Authorization header không đúng định dạng Bearer token',
        );
      }

      const claims = tokenService.verifyAccessToken(token);

      req.user = {
        ma_nguoi_dung: claims.sub,
        ho_va_ten: claims.ho_va_ten,
        ten_vai_tro: claims.ten_vai_tro,
        ma_chi_nhanh: claims.ma_chi_nhanh,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
