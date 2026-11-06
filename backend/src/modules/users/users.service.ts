import { ACCOUNT_STATUS, ROLES, type AccountStatus, type RoleName } from '../../common/constants';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { getDuplicateField, isDuplicateEntryError } from '../../common/errors/db-errors';
import { HTTP_STATUS } from '../../common/http-status';
import { withTransaction } from '../../db/transaction';
import { normalizeVietnamesePhone, isValidVietnamesePhone } from '../../utils/phone';
import type { PasswordService } from '../../utils/password';
import { buildPaginationMeta, resolvePagination } from '../../utils/pagination';
import type {
  CreateUserInput,
  RoleRecord,
  UserListFilters,
  UserRecord,
  UserRepositoryPort,
  UserWithPassword,
} from './users.types';

export interface UserServiceScope {
  all: boolean;
  ma_chi_nhanh: number | null;
}

export interface CreateUserRequest {
  ma_vai_tro: number;
  ma_chi_nhanh?: number | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email?: string | null;
  mat_khau: string;
  trang_thai_tai_khoan?: string;
}

export interface UpdateUserRequest {
  ma_vai_tro: number;
  ma_chi_nhanh?: number | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email?: string | null;
  trang_thai_tai_khoan?: string;
}

const BRANCH_MANAGER_ROLES: readonly RoleName[] = [
  ROLES.NHAN_VIEN_PHONG_VE,
  ROLES.DIEU_HANH,
  ROLES.TAI_XE,
  ROLES.KHACH_HANG,
];

const BRANCH_REQUIRED_ROLES: readonly RoleName[] = [
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.NHAN_VIEN_PHONG_VE,
  ROLES.DIEU_HANH,
  ROLES.TAI_XE,
];

function normalizeStatus(value: string | undefined): AccountStatus {
  const status = (value ?? ACCOUNT_STATUS.HOAT_DONG) as AccountStatus;

  if (status !== ACCOUNT_STATUS.HOAT_DONG && status !== ACCOUNT_STATUS.KHOA) {
    throw new AppError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      'Trạng thái tài khoản không hợp lệ',
    );
  }

  return status;
}

function normalizeScope(scope: UserServiceScope | undefined): UserServiceScope {
  return scope ?? { all: true, ma_chi_nhanh: null };
}

function ensureScope(user: UserRecord, scope: UserServiceScope): void {
  if (!scope.all && (scope.ma_chi_nhanh === null || user.ma_chi_nhanh !== scope.ma_chi_nhanh)) {
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.FORBIDDEN,
      'Bạn không có quyền quản lý người dùng của chi nhánh khác',
    );
  }
}

function duplicateUserError(error: unknown): AppError | null {
  if (!isDuplicateEntryError(error)) {
    return null;
  }

  const field = getDuplicateField(error);
  if (field === 'email') {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.USER_EMAIL_EXISTS,
      'Email đã được sử dụng bởi tài khoản khác',
    );
  }

  return new AppError(
    HTTP_STATUS.CONFLICT,
    ERROR_CODES.USER_PHONE_EXISTS,
    'Số điện thoại đã được sử dụng bởi tài khoản khác',
  );
}

export interface UserListResult {
  items: UserRecord[];
  meta: ReturnType<typeof buildPaginationMeta>;
}

export class UserService {
  public constructor(
    private readonly repository: UserRepositoryPort,
    private readonly passwordService: PasswordService,
  ) {}

  public async list(
    query: {
      q?: string;
      ma_vai_tro?: unknown;
      ma_chi_nhanh?: unknown;
      trang_thai_tai_khoan?: string;
      page?: unknown;
      limit?: unknown;
    },
    scopeValue?: UserServiceScope,
  ): Promise<UserListResult> {
    const scope = normalizeScope(scopeValue);
    const pagination = resolvePagination(query.page, query.limit);
    const roleId = query.ma_vai_tro === undefined ? null : Number(query.ma_vai_tro);
    const requestedBranch = query.ma_chi_nhanh === undefined ? null : Number(query.ma_chi_nhanh);

    if (!scope.all) {
      if (scope.ma_chi_nhanh === null) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.FORBIDDEN,
          'Tài khoản chưa được gán chi nhánh',
        );
      }

      if (requestedBranch !== null && requestedBranch !== scope.ma_chi_nhanh) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.FORBIDDEN,
          'Bạn không có quyền xem người dùng của chi nhánh khác',
        );
      }
    }

    const status = query.trang_thai_tai_khoan?.trim().toUpperCase();

    const filters: UserListFilters = {
      q: query.q?.trim() || null,
      ma_vai_tro: Number.isInteger(roleId) && roleId !== null && roleId > 0 ? roleId : null,
      ma_chi_nhanh: scope.all
        ? requestedBranch !== null && requestedBranch > 0
          ? requestedBranch
          : null
        : scope.ma_chi_nhanh,
      trang_thai_tai_khoan:
        status === ACCOUNT_STATUS.HOAT_DONG || status === ACCOUNT_STATUS.KHOA
          ? (status as AccountStatus)
          : null,
      pagination,
    };

    const result = await this.repository.list(filters);
    return {
      items: result.items,
      meta: buildPaginationMeta(result.total, pagination),
    };
  }

  public async getById(id: string, scopeValue?: UserServiceScope): Promise<UserRecord> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
      );
    }

    ensureScope(user, normalizeScope(scopeValue));
    return this.toPublicUser(user);
  }

  public async listRoles(): Promise<RoleRecord[]> {
    return this.repository.listRoles();
  }

  public async create(
    input: CreateUserRequest,
    scopeValue?: UserServiceScope,
  ): Promise<UserRecord> {
    const scope = normalizeScope(scopeValue);
    const role = await this.repository.findRoleById(input.ma_vai_tro);

    if (!role) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.USER_ROLE_INVALID,
        'Vai trò không hợp lệ',
      );
    }

    this.assertRolePermission(role.ten_vai_tro, scope);

    const phone = normalizeVietnamesePhone(input.so_dien_thoai);
    if (!isValidVietnamesePhone(phone)) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Số điện thoại không hợp lệ',
      );
    }

    const email = input.email?.trim().toLowerCase() || null;
    const branchId = await this.resolveBranch(role.ten_vai_tro, input.ma_chi_nhanh, scope);

    if (await this.repository.phoneExists(phone)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.USER_PHONE_EXISTS,
        'Số điện thoại đã được sử dụng bởi tài khoản khác',
      );
    }

    if (email && (await this.repository.emailExists(email))) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.USER_EMAIL_EXISTS,
        'Email đã được sử dụng bởi tài khoản khác',
      );
    }

    const passwordHash = await this.passwordService.hash(input.mat_khau);
    const createInput: CreateUserInput = {
      ma_vai_tro: role.ma_vai_tro,
      ma_chi_nhanh: branchId,
      ho_va_ten: input.ho_va_ten.trim(),
      so_dien_thoai: phone,
      email,
      mat_khau_ma_hoa: passwordHash,
      trang_thai_tai_khoan: normalizeStatus(input.trang_thai_tai_khoan),
    };

    try {
      return await withTransaction(async (connection) => {
        const id = await this.repository.create(createInput, connection);
        const created = await this.repository.findById(id, connection);
        if (!created) {
          throw new Error('User was created but could not be reloaded');
        }

        return this.toPublicUser(created);
      });
    } catch (error) {
      const duplicate = duplicateUserError(error);
      if (duplicate) {
        throw duplicate;
      }

      throw error;
    }
  }

  public async update(
    id: string,
    input: UpdateUserRequest,
    scopeValue?: UserServiceScope,
    actorId?: string,
  ): Promise<UserRecord> {
    const scope = normalizeScope(scopeValue);
    await this.findWithScope(id, scope);
    const role = await this.repository.findRoleById(input.ma_vai_tro);

    if (!role) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.USER_ROLE_INVALID,
        'Vai trò không hợp lệ',
      );
    }

    this.assertRolePermission(role.ten_vai_tro, scope);

    const phone = normalizeVietnamesePhone(input.so_dien_thoai);
    if (!isValidVietnamesePhone(phone)) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Số điện thoại không hợp lệ',
      );
    }

    const email = input.email?.trim().toLowerCase() || null;
    const branchId = await this.resolveBranch(role.ten_vai_tro, input.ma_chi_nhanh, scope);
    const status = normalizeStatus(input.trang_thai_tai_khoan);

    if (status === ACCOUNT_STATUS.KHOA && actorId !== undefined && actorId === id) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VALIDATION_ERROR,
        'Không thể tự khóa tài khoản đang đăng nhập',
      );
    }

    if (await this.repository.phoneExists(phone, id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.USER_PHONE_EXISTS,
        'Số điện thoại đã được sử dụng bởi tài khoản khác',
      );
    }

    if (email && (await this.repository.emailExists(email, id))) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.USER_EMAIL_EXISTS,
        'Email đã được sử dụng bởi tài khoản khác',
      );
    }

    try {
      return await withTransaction(async (connection) => {
        await this.repository.update(
          id,
          {
            ma_vai_tro: role.ma_vai_tro,
            ma_chi_nhanh: branchId,
            ho_va_ten: input.ho_va_ten.trim(),
            so_dien_thoai: phone,
            email,
            trang_thai_tai_khoan: status,
          },
          connection,
        );

        const updated = await this.repository.findById(id, connection);
        if (!updated) {
          throw new Error('User was updated but could not be reloaded');
        }

        return this.toPublicUser(updated);
      });
    } catch (error) {
      const duplicate = duplicateUserError(error);
      if (duplicate) {
        throw duplicate;
      }

      throw error;
    }
  }

  public async changeStatus(
    id: string,
    statusValue: string,
    scopeValue?: UserServiceScope,
    actorId?: string,
  ): Promise<UserRecord> {
    const scope = normalizeScope(scopeValue);
    const existing = await this.findWithScope(id, scope);
    const status = normalizeStatus(statusValue);

    if (status === ACCOUNT_STATUS.KHOA && actorId !== undefined && actorId === id) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VALIDATION_ERROR,
        'Không thể tự khóa tài khoản đang đăng nhập',
      );
    }

    await withTransaction(async (connection) => {
      await this.repository.update(
        id,
        {
          ma_vai_tro: existing.ma_vai_tro,
          ma_chi_nhanh: existing.ma_chi_nhanh,
          ho_va_ten: existing.ho_va_ten,
          so_dien_thoai: existing.so_dien_thoai,
          email: existing.email,
          trang_thai_tai_khoan: status,
        },
        connection,
      );
    });

    return this.getById(id, scope);
  }

  public async resetPassword(
    id: string,
    newPassword: string,
    scopeValue?: UserServiceScope,
  ): Promise<void> {
    const scope = normalizeScope(scopeValue);
    await this.findWithScope(id, scope);
    const passwordHash = await this.passwordService.hash(newPassword);

    await withTransaction(async (connection) => {
      await this.repository.updatePassword(id, passwordHash, connection);
    });
  }

  public async delete(id: string, scopeValue?: UserServiceScope, actorId?: string): Promise<void> {
    const scope = normalizeScope(scopeValue);
    await this.findWithScope(id, scope);

    if (actorId !== undefined && actorId === id) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VALIDATION_ERROR,
        'Không thể xóa tài khoản đang đăng nhập',
      );
    }

    if (await this.repository.hasReferences(id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.USER_IN_USE,
        'Không thể xóa người dùng đã phát sinh chuyến xe, đơn vé hoặc soát vé',
      );
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
      );
    }
  }

  private async findWithScope(id: string, scope: UserServiceScope): Promise<UserWithPassword> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
      );
    }

    ensureScope(user, scope);
    return user;
  }

  private assertRolePermission(role: RoleName, scope: UserServiceScope): void {
    if (scope.all) {
      return;
    }

    if (!BRANCH_MANAGER_ROLES.includes(role)) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        'Bạn không có quyền gán vai trò này',
      );
    }
  }

  private async resolveBranch(
    role: RoleName,
    requestedBranch: number | null | undefined,
    scope: UserServiceScope,
  ): Promise<number | null> {
    if (!BRANCH_REQUIRED_ROLES.includes(role)) {
      return null;
    }

    let branchId = requestedBranch ?? null;

    if (!scope.all) {
      if (scope.ma_chi_nhanh === null) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.FORBIDDEN,
          'Tài khoản chưa được gán chi nhánh',
        );
      }

      if (branchId !== null && branchId !== scope.ma_chi_nhanh) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.FORBIDDEN,
          'Bạn chỉ có thể gán người dùng vào chi nhánh của mình',
        );
      }

      branchId = scope.ma_chi_nhanh;
    }

    if (branchId === null) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.USER_BRANCH_INVALID,
        'Vai trò này bắt buộc phải thuộc một chi nhánh',
      );
    }

    const branch = await this.repository.findBranchById(branchId);
    if (!branch) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.USER_BRANCH_INVALID,
        'Chi nhánh không tồn tại',
      );
    }

    if (!branch.trang_thai_hoat_dong) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.USER_BRANCH_INVALID,
        'Chi nhánh đang ngừng hoạt động',
      );
    }

    return branch.ma_chi_nhanh;
  }

  private toPublicUser(user: UserWithPassword): UserRecord {
    return {
      ma_nguoi_dung: user.ma_nguoi_dung,
      ma_vai_tro: user.ma_vai_tro,
      ten_vai_tro: user.ten_vai_tro,
      ma_chi_nhanh: user.ma_chi_nhanh,
      ten_chi_nhanh: user.ten_chi_nhanh,
      ho_va_ten: user.ho_va_ten,
      so_dien_thoai: user.so_dien_thoai,
      email: user.email,
      trang_thai_tai_khoan: user.trang_thai_tai_khoan,
      thoi_gian_tao: user.thoi_gian_tao,
    };
  }
}
