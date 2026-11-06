import type { RequestHandler } from 'express';
import { validationResult, type ValidationChain } from 'express-validator';
import { AppError } from '../common/errors/AppError';
import { ERROR_CODES } from '../common/errors/error-codes';
import { HTTP_STATUS } from '../common/http-status';

export function validate(validators: ValidationChain[]): RequestHandler[] {
  const resultHandler: RequestHandler = (req, _res, next) => {
    const result = validationResult(req);

    if (!result.isEmpty()) {
      const details = result.array().map((error) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
      }));

      next(
        new AppError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          ERROR_CODES.VALIDATION_ERROR,
          'Dữ liệu đầu vào không hợp lệ',
          details,
        ),
      );
      return;
    }

    next();
  };

  return [...validators, resultHandler];
}
