import type { PaginationMeta } from './api';

export type StopType = 'DON' | 'TRA' | 'TRUNG_CHUYEN';

export interface RouteStop {
  ma_diem_dung?: number;
  ten_diem_dung: string;
  dia_chi: string | null;
  loai_diem: StopType;
  thu_tu_dung: number;
}

export interface Route {
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  khoang_cach_km: string;
  thoi_gian_chay_du_kien: number;
  trang_thai: boolean;
  diem_dung: RouteStop[];
}

export type RouteStatusFilter = 'all' | 'true' | 'false';

export interface RouteListFilters {
  q?: string;
  tinh_di?: string;
  tinh_den?: string;
  trang_thai?: RouteStatusFilter;
  page: number;
  limit: number;
}

export interface RouteListResult {
  items: Route[];
  meta: PaginationMeta;
}

export interface RouteInput {
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  khoang_cach_km: number;
  thoi_gian_chay_du_kien: number;
  trang_thai: boolean;
  diem_dung: RouteStop[];
}
