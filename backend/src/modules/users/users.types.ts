import type { AccountStatus, RoleName } from '../../common/constants';
import type { DbExecutor } from '../../db/types';
import type { Pagination } from '../../utils/pagination';

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

export interface UserWithPassword extends UserRecord {
  mat_khau_ma_hoa: string;
}

export interface UserListFilters {
  q: string | null;
  ma_vai_tro: number | null;
  ma_chi_nhanh: number | null;
  trang_thai_tai_khoan: AccountStatus | null;
  pagination: Pagination;
}

export interface CreateUserInput {
  ma_vai_tro: number;
  ma_chi_nhanh: number | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
  mat_khau_ma_hoa: string;
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

export interface RoleRecord {
  ma_vai_tro: number;
  ten_vai_tro: RoleName;
  mo_ta: string | null;
}

export interface BranchOptionRecord {
  ma_chi_nhanh: number;
  ma_dinh_danh: string;
  ten_chi_nhanh: string;
  trang_thai_hoat_dong: boolean;
}

export interface UserRepositoryPort {
  list(filters: UserListFilters): Promise<{ items: UserRecord[]; total: number }>;
  findById(id: string, executor?: DbExecutor): Promise<UserWithPassword | null>;
  phoneExists(phone: string, excludeId?: string): Promise<boolean>;
  emailExists(email: string, excludeId?: string): Promise<boolean>;
  findRoleById(id: number): Promise<RoleRecord | null>;
  findBranchById(id: number): Promise<BranchOptionRecord | null>;
  listRoles(): Promise<RoleRecord[]>;
  create(input: CreateUserInput, executor: DbExecutor): Promise<string>;
  update(id: string, input: UpdateUserInput, executor: DbExecutor): Promise<void>;
  updatePassword(id: string, passwordHash: string, executor?: DbExecutor): Promise<void>;
  delete(id: string): Promise<boolean>;
  hasReferences(id: string, executor?: DbExecutor): Promise<boolean>;
}
