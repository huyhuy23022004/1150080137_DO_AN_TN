import type { Response } from 'express';
import { HTTP_STATUS } from './http-status';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: object;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = HTTP_STATUS.OK,
  meta?: object,
): Response {
  const body: SuccessEnvelope<T> = meta ? { success: true, data, meta } : { success: true, data };
  return res.status(statusCode).json(body);
}
