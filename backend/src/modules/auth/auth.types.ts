import type { RoleName } from '../../common/constants';

export interface AuthUserRecord {
  ma_nguoi_dung: string;
  ma_vai_tro: number;
  ma_chi_nhanh: number | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
  mat_khau_ma_hoa: string;
  trang_thai_tai_khoan: string;
  thoi_gian_tao: string;
  ten_vai_tro: RoleName;
}

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

export interface RoleRecord {
  ma_vai_tro: number;
  ten_vai_tro: RoleName;
}

export interface CreateUserInput {
  ma_vai_tro: number;
  ma_chi_nhanh: number | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
  mat_khau_ma_hoa: string;
}

export interface RegisterInput {
  ho_va_ten: string;
  so_dien_thoai: string;
  email?: string | null;
  mat_khau: string;
  xac_nhan_mat_khau: string;
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

export interface UpdateProfileInput {
  ho_va_ten?: string;
  so_dien_thoai?: string;
  email?: string | null;
}

export interface UpdateProfileRecord {
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: PublicUser;
}

export interface AuthRepositoryPort {
  findRoleByName(roleName: string): Promise<RoleRecord | null>;
  findUserByPhone(phone: string): Promise<AuthUserRecord | null>;
  findUserById(userId: string): Promise<AuthUserRecord | null>;
  phoneExists(phone: string, excludeUserId?: string): Promise<boolean>;
  emailExists(email: string, excludeUserId?: string): Promise<boolean>;
  createUser(input: CreateUserInput): Promise<string>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  updateProfile(userId: string, input: UpdateProfileRecord): Promise<void>;
}
