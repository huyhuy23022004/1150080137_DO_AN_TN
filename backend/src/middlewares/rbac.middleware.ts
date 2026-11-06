import type { RequestHandler } from 'express';
import type { RoleName } from '../common/constants';
import { ROLES } from '../common/constants';
import { AppError } from '../common/errors/AppError';
import { ERROR_CODES } from '../common/errors/error-codes';
import { HTTP_STATUS } from '../common/http-status';

export function requireRoles(...allowedRoles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(
        new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.AUTH_TOKEN_MISSING,
          'Bạn cần đăng nhập để thực hiện thao tác này',
        ),
      );
      return;
    }

    if (!allowedRoles.includes(req.user.ten_vai_tro)) {
      next(
        new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.FORBIDDEN,
          'Bạn không có quyền thực hiện thao tác này',
        ),
      );
      return;
    }

    next();
  };
}

export const attachBranchScope: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(
      new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.AUTH_TOKEN_MISSING,
        'Bạn cần đăng nhập để thực hiện thao tác này',
      ),
    );
    return;
  }

  const isGlobalRole =
    req.user.ten_vai_tro === ROLES.QUAN_TRI_VIEN || req.user.ten_vai_tro === ROLES.DIEU_HANH;

  req.scope = {
    all: isGlobalRole,
    ma_chi_nhanh: isGlobalRole ? null : req.user.ma_chi_nhanh,
  };

  next();
};
