import type { PaginationMeta } from './api';

export type VehicleStatus = 'HOAT_DONG' | 'BAO_DUONG' | 'DANG_CHAY';

export interface Vehicle {
  ma_xe: number;
  ma_loai_xe: number;
  ten_loai_xe: string;
  tong_so_ghe: number;
  bien_so_xe: string;
  hang_san_xuat: string | null;
  trang_thai: VehicleStatus;
}

export interface VehicleListFilters {
  q?: string;
  ma_loai_xe?: number;
  trang_thai?: VehicleStatus;
  page: number;
  limit: number;
}

export interface VehicleListResult {
  items: Vehicle[];
  meta: PaginationMeta;
}

export interface VehicleInput {
  ma_loai_xe: number;
  bien_so_xe: string;
  hang_san_xuat: string | null;
  trang_thai: VehicleStatus;
}
