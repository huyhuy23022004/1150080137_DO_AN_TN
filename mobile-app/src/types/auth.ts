export type RoleName =
  | 'QUAN_TRI_VIEN'
  | 'QUAN_LY_CHI_NHANH'
  | 'NHAN_VIEN_PHONG_VE'
  | 'DIEU_HANH'
  | 'TAI_XE'
  | 'KHACH_HANG';

export type MobileRole = Extract<RoleName, 'KHACH_HANG' | 'TAI_XE'>;

export interface PublicUser {
  ma_nguoi_dung: string;
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
  ma_chi_nhanh: number | null;
  ten_vai_tro: RoleName;
  trang_thai_tai_khoan: 'HOAT_DONG' | 'KHOA' | string;
  thoi_gian_tao: string;
}

export interface AuthPayload {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  nguoi_dung: PublicUser;
}

export interface UpdateProfileInput {
  ho_va_ten?: string;
  so_dien_thoai?: string;
  email?: string | null;
}

export interface ChangePasswordInput {
  mat_khau_cu: string;
  mat_khau_moi: string;
  xac_nhan_mat_khau_moi: string;
}

export interface LoginInput {
  so_dien_thoai: string;
  mat_khau: string;
}

export interface RegisterInput {
  ho_va_ten: string;
  so_dien_thoai: string;
  email?: string;
  mat_khau: string;
  xac_nhan_mat_khau: string;
}
