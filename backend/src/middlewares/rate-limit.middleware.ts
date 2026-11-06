import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { config } from '../config/env';
import { ERROR_CODES } from '../common/errors/error-codes';
import { HTTP_STATUS } from '../common/http-status';

function rateLimitHandler(req: Request, res: Response): void {
  res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
    success: false,
    code: ERROR_CODES.RATE_LIMITED,
    message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau',
    trace_id: req.requestId,
  });
}

function createLimiter(max: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}

export const globalLimiter = createLimiter(config.rateLimit.max);
export const authLimiter = createLimiter(config.rateLimit.authMax);
export const loginLimiter = createLimiter(config.rateLimit.authMax);
export const refreshLimiter = createLimiter(config.rateLimit.authMax * 3);
export const ipnLimiter = createLimiter(config.rateLimit.ipnMax);
