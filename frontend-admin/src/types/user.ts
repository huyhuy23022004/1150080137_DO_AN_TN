import type { PaginationMeta } from './api';
import type { RoleName } from '@/lib/roles';

export type AccountStatus = 'HOAT_DONG' | 'KHOA';

export interface RoleOption {
  ma_vai_tro: number;
  ten_vai_tro: RoleName;
  mo_ta: string | null;
}

export interface UserRecord {
  ma_nguoi_dung: string;
  ma_vai_tro: number;
  ten_vai_tro: RoleName;
  ma_chi_nhanh: number | null;
  ten_chi_nhanh: string | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
  trang_thai_tai_khoan: AccountStatus;
  thoi_gian_tao: string;
}

export interface UserListFilters {
  q?: string;
  ma_vai_tro?: number;
  ma_chi_nhanh?: number;
  trang_thai_tai_khoan?: AccountStatus;
  page: number;
  limit: number;
}

export interface UserListResult {
  items: UserRecord[];
  meta: PaginationMeta;
}

export interface CreateUserInput {
  ma_vai_tro: number;
  ma_chi_nhanh: number | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
  mat_khau: string;
  trang_thai_tai_khoan: AccountStatus;
}

export interface UpdateUserInput {
  ma_vai_tro: number;
  ma_chi_nhanh: number | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
  trang_thai_tai_khoan: AccountStatus;
}
