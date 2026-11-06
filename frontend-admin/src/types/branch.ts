import type { PaginationMeta } from './api';

export interface Branch {
  ma_chi_nhanh: number;
  ma_dinh_danh: string;
  ten_chi_nhanh: string;
  so_dien_thoai: string;
  dia_chi: string;
  tinh_thanh: string;
  trang_thai_hoat_dong: boolean;
}

export interface BranchInput {
  ma_dinh_danh: string;
  ten_chi_nhanh: string;
  so_dien_thoai: string;
  dia_chi: string;
  tinh_thanh: string;
  trang_thai_hoat_dong: boolean;
}

export type BranchStatusFilter = 'all' | 'true' | 'false';

export interface BranchListFilters {
  q?: string;
  tinh_thanh?: string;
  trang_thai_hoat_dong?: BranchStatusFilter;
  page: number;
  limit: number;
}

export interface BranchListResult {
  items: Branch[];
  meta: PaginationMeta;
}
