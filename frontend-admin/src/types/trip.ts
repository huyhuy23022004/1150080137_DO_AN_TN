import type { PaginationMeta } from './api';
import type { RouteStop } from './route';

export type TripStatus = 'SAP_CHAY' | 'DANG_CHAY' | 'HOAN_THANH' | 'HUY';

export interface Trip {
  ma_chuyen: number;
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  ma_xe: number;
  bien_so_xe: string;
  ma_loai_xe: number;
  ten_loai_xe: string;
  tong_so_ghe: number;
  ma_tai_xe: string;
  ten_tai_xe: string;
  so_dien_thoai_tai_xe: string;
  ma_chi_nhanh_tai_xe: number | null;
  thoi_gian_xuat_ben: string;
  thoi_gian_den_du_kien: string;
  gia_ve_co_ban: string;
  trang_thai: TripStatus;
  so_ghe_da_dat: number;
  so_ghe_dang_giu: number;
  so_ghe_trong: number;
}

export interface TripDetail extends Trip {
  diem_dung: RouteStop[];
}

export interface TripListFilters {
  tinh_di?: string;
  tinh_den?: string;
  ma_tuyen?: number;
  ma_xe?: number;
  ma_tai_xe?: string;
  trang_thai?: TripStatus;
  tu_ngay?: string;
  den_ngay?: string;
  page: number;
  limit: number;
}

export interface TripListResult {
  items: Trip[];
  meta: PaginationMeta;
}

export interface TripInput {
  ma_tuyen: number;
  ma_xe: number;
  ma_tai_xe: string;
  thoi_gian_xuat_ben: string;
  thoi_gian_den_du_kien: string;
  gia_ve_co_ban: number;
  trang_thai?: TripStatus;
}
