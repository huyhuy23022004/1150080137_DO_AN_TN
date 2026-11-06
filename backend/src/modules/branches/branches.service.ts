import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { HTTP_STATUS } from '../../common/http-status';
import { withTransaction } from '../../db/transaction';
import { normalizeVietnamesePhone } from '../../utils/phone';
import { buildPaginationMeta, resolvePagination } from '../../utils/pagination';
import type {
  BranchListFilters,
  BranchRecord,
  BranchRepositoryPort,
  CreateBranchInput,
  UpdateBranchInput,
} from './branches.types';

const BRANCH_PHONE_PATTERN = /^0\d{9,10}$/;

function normalizeStatus(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const text = String(value).trim().toUpperCase();
  if (text === 'TRUE' || text === 'HOAT_DONG' || text === '1') {
    return true;
  }

  if (text === 'FALSE' || text === 'NGUNG_HOAT_DONG' || text === '0') {
    return false;
  }

  throw new AppError(
    HTTP_STATUS.UNPROCESSABLE_ENTITY,
    ERROR_CODES.VALIDATION_ERROR,
    'Trạng thái chi nhánh không hợp lệ',
  );
}

function parseStatusFilter(value: unknown): boolean | null {
  if (value === undefined) {
    return true;
  }

  if (String(value).toLowerCase() === 'all') {
    return null;
  }

  return normalizeStatus(value);
}

function normalizeBranchInput(input: CreateBranchInput): CreateBranchInput {
  const phone = normalizeVietnamesePhone(input.so_dien_thoai);

  if (!BRANCH_PHONE_PATTERN.test(phone)) {
    throw new AppError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      'Số điện thoại chi nhánh không hợp lệ',
    );
  }

  return {
    ma_dinh_danh: input.ma_dinh_danh.trim().toUpperCase(),
    ten_chi_nhanh: input.ten_chi_nhanh.trim(),
    so_dien_thoai: phone,
    dia_chi: input.dia_chi.trim(),
    tinh_thanh: input.tinh_thanh.trim(),
    trang_thai_hoat_dong: normalizeStatus(input.trang_thai_hoat_dong),
  };
}

export interface BranchListResult {
  items: BranchRecord[];
  meta: ReturnType<typeof buildPaginationMeta>;
}

export class BranchService {
  public constructor(private readonly repository: BranchRepositoryPort) {}

  public async list(query: {
    q?: string;
    tinh_thanh?: string;
    trang_thai_hoat_dong?: string;
    page?: unknown;
    limit?: unknown;
  }): Promise<BranchListResult> {
    const pagination = resolvePagination(query.page, query.limit);
    const filters: BranchListFilters = {
      q: query.q?.trim() || null,
      tinh_thanh: query.tinh_thanh?.trim() || null,
      trang_thai_hoat_dong: parseStatusFilter(query.trang_thai_hoat_dong),
      pagination,
    };

    const result = await this.repository.list(filters);
    return {
      items: result.items,
      meta: buildPaginationMeta(result.total, pagination),
    };
  }

  public async getById(id: number): Promise<BranchRecord> {
    const branch = await this.repository.findById(id);
    if (!branch) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.BRANCH_NOT_FOUND,
        'Không tìm thấy chi nhánh',
      );
    }

    return branch;
  }

  public async create(input: CreateBranchInput): Promise<BranchRecord> {
    const normalized = normalizeBranchInput(input);

    if (await this.repository.codeExists(normalized.ma_dinh_danh)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.BRANCH_CODE_EXISTS,
        'Mã định danh chi nhánh đã tồn tại',
      );
    }

    if (await this.repository.phoneExists(normalized.so_dien_thoai)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VALIDATION_ERROR,
        'Số điện thoại chi nhánh đã tồn tại',
      );
    }

    return withTransaction(async (connection) => {
      const id = await this.repository.create(normalized, connection);
      const created = await this.repository.findById(id, connection);
      if (!created) {
        throw new Error('Branch was created but could not be reloaded');
      }

      return created;
    });
  }

  public async update(id: number, input: UpdateBranchInput): Promise<BranchRecord> {
    await this.getById(id);
    const normalized = normalizeBranchInput(input);

    if (await this.repository.codeExists(normalized.ma_dinh_danh, id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.BRANCH_CODE_EXISTS,
        'Mã định danh chi nhánh đã tồn tại',
      );
    }

    if (await this.repository.phoneExists(normalized.so_dien_thoai, id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VALIDATION_ERROR,
        'Số điện thoại chi nhánh đã tồn tại',
      );
    }

    return withTransaction(async (connection) => {
      await this.repository.update(id, normalized, connection);
      const updated = await this.repository.findById(id, connection);
      if (!updated) {
        throw new Error('Branch was updated but could not be reloaded');
      }

      return updated;
    });
  }

  public async delete(id: number): Promise<void> {
    await this.getById(id);

    if (await this.repository.hasUsers(id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.BRANCH_IN_USE,
        'Không thể xóa chi nhánh đang có người dùng',
      );
    }

    if (await this.repository.hasOrders(id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.BRANCH_IN_USE,
        'Không thể xóa chi nhánh đã phát sinh đơn đặt vé',
      );
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.BRANCH_NOT_FOUND,
        'Không tìm thấy chi nhánh',
      );
    }
  }
}
