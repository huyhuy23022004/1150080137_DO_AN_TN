import { isAxiosError } from 'axios';
import type { ApiErrorBody, ValidationDetail } from '../types/api';

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: ValidationDetail[] | unknown;
  public readonly traceId: string | null;

  public constructor(
    code: string,
    message: string,
    status = 0,
    details: ValidationDetail[] | unknown = null,
    traceId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.traceId = traceId;
  }
}

function isValidationDetails(value: unknown): value is ValidationDetail[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { message?: unknown }).message === 'string',
    )
  );
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiErrorBody> | undefined;
    const status = error.response?.status ?? 0;
    const message =
      (typeof body?.message === 'string' && body.message) ||
      (status === 0
        ? 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng.'
        : 'Đã xảy ra lỗi, vui lòng thử lại.');

    return new ApiError(
      typeof body?.code === 'string' ? body.code : 'NETWORK_ERROR',
      message,
      status,
      body?.details ?? null,
      typeof body?.trace_id === 'string' ? body.trace_id : null,
    );
  }

  if (error instanceof Error) {
    return new ApiError('UNKNOWN_ERROR', error.message);
  }

  return new ApiError('UNKNOWN_ERROR', 'Đã xảy ra lỗi không xác định.');
}

export function getFieldErrors(error: unknown): Record<string, string> {
  const normalized = normalizeApiError(error);

  if (!isValidationDetails(normalized.details)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const detail of normalized.details) {
    if (detail.field) {
      result[detail.field] = detail.message;
    }
  }

  return result;
}

export function getErrorMessage(error: unknown): string {
  return normalizeApiError(error).message;
}
