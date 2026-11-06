export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ValidationDetail {
  field?: string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  code: string;
  message: string;
  details?: ValidationDetail[] | unknown;
  trace_id?: string;
}
