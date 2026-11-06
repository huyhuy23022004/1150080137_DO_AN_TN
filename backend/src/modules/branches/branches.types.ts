import type { DbExecutor } from '../../db/types';
import type { Pagination } from '../../utils/pagination';

export interface BranchRecord {
  ma_chi_nhanh: number;
  ma_dinh_danh: string;
  ten_chi_nhanh: string;
  so_dien_thoai: string;
  dia_chi: string;
  tinh_thanh: string;
  trang_thai_hoat_dong: boolean;
}

export interface BranchListFilters {
  q: string | null;
  tinh_thanh: string | null;
  trang_thai_hoat_dong: boolean | null;
  pagination: Pagination;
}

export interface CreateBranchInput {
  ma_dinh_danh: string;
  ten_chi_nhanh: string;
  so_dien_thoai: string;
  dia_chi: string;
  tinh_thanh: string;
  trang_thai_hoat_dong: boolean;
}

export type UpdateBranchInput = CreateBranchInput;

export interface BranchRepositoryPort {
  list(filters: BranchListFilters): Promise<{ items: BranchRecord[]; total: number }>;
  findById(id: number, executor?: DbExecutor): Promise<BranchRecord | null>;
  codeExists(code: string, excludeId?: number): Promise<boolean>;
  phoneExists(phone: string, excludeId?: number): Promise<boolean>;
  create(input: CreateBranchInput, executor: DbExecutor): Promise<number>;
  update(id: number, input: UpdateBranchInput, executor: DbExecutor): Promise<void>;
  delete(id: number): Promise<boolean>;
  hasUsers(id: number, executor?: DbExecutor): Promise<boolean>;
  hasOrders(id: number, executor?: DbExecutor): Promise<boolean>;
}
