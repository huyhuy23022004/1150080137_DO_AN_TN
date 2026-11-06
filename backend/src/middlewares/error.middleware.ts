import type { ErrorRequestHandler } from 'express';
import { AppError } from '../common/errors/AppError';
import { ERROR_CODES } from '../common/errors/error-codes';
import { getMySqlErrorCode, isDuplicateEntryError } from '../common/errors/db-errors';
import { HTTP_STATUS } from '../common/http-status';
import { logger } from '../config/logger';

interface ErrorLike {
  status?: unknown;
  statusCode?: unknown;
  type?: unknown;
}

function readStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const candidate = error as ErrorLike;
  const status =
    typeof candidate.statusCode === 'number'
      ? candidate.statusCode
      : typeof candidate.status === 'number'
        ? candidate.status
        : null;

  return status;
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const type = (error as ErrorLike).type;

    if (type === 'entity.too.large') {
      return new AppError(
        HTTP_STATUS.PAYLOAD_TOO_LARGE,
        ERROR_CODES.VALIDATION_ERROR,
        'Dữ liệu gửi lên quá lớn',
      );
    }

    if (error instanceof SyntaxError && readStatus(error) === HTTP_STATUS.BAD_REQUEST) {
      return new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_JSON,
        'JSON trong request body không hợp lệ',
      );
    }
  }

  if (isDuplicateEntryError(error)) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.DUPLICATE_ENTRY,
      'Dữ liệu đã tồn tại trong hệ thống',
    );
  }

  const mysqlCode = getMySqlErrorCode(error);
  if (mysqlCode === 'ER_NO_REFERENCED_ROW_2') {
    return new AppError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      'Dữ liệu tham chiếu không tồn tại',
    );
  }

  if (mysqlCode === 'ER_ROW_IS_REFERENCED_2') {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.DUPLICATE_ENTRY,
      'Dữ liệu đang được sử dụng ở nơi khác',
    );
  }

  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.INTERNAL_ERROR,
    'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau',
  );
}

export const errorMiddleware: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = normalizeError(error);

  if (appError.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    logger.error(
      {
        err: error,
        code: appError.code,
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
      },
      'request_failed',
    );
  } else {
    logger.warn(
      {
        code: appError.code,
        statusCode: appError.statusCode,
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
      },
      'request_rejected',
    );
  }

  const body: Record<string, unknown> = {
    success: false,
    code: appError.code,
    message: appError.message,
    trace_id: req.requestId,
  };

  if (appError.details !== undefined) {
    body.details = appError.details;
  }

  res.status(appError.statusCode).json(body);
};
