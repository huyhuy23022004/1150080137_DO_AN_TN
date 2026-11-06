import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/AppError';
import { ERROR_CODES } from '../common/errors/error-codes';
import { HTTP_STATUS } from '../common/http-status';

export const notFoundMiddleware: RequestHandler = (req, _res, next) => {
  next(
    new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.NOT_FOUND,
      `Không tìm thấy endpoint ${req.method} ${req.originalUrl}`,
    ),
  );
};
