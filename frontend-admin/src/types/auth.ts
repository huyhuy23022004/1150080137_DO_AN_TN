import type { AdminRole, RoleName } from '@/lib/roles';

export interface PublicUser {
  ma_nguoi_dung: string;
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
  ma_chi_nhanh: number | null;
  ten_vai_tro: RoleName;
  trang_thai_tai_khoan: string;
  thoi_gian_tao: string;
}

export type AdminUser = Omit<PublicUser, 'ten_vai_tro'> & {
  ten_vai_tro: AdminRole;
};

export interface AuthPayload {
  access_token: string;
  token_type: string;
  expires_in: number;
  nguoi_dung: PublicUser;
}

export interface LoginInput {
  so_dien_thoai: string;
  mat_khau: string;
}

export interface ChangePasswordInput {
  mat_khau_cu: string;
  mat_khau_moi: string;
  xac_nhan_mat_khau_moi: string;
}
