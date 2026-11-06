import { describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '../../src/common/errors/error-codes';
import { UserService } from '../../src/modules/users/users.service';
import type { UserRepositoryPort, UserWithPassword } from '../../src/modules/users/users.types';
import type { PasswordService } from '../../src/utils/password';

vi.mock('../../src/db/transaction', () => ({
  withTransaction: async <T>(work: (connection: object) => Promise<T>): Promise<T> => work({}),
}));

const STAFF: UserWithPassword = {
  ma_nguoi_dung: '10',
  ma_vai_tro: 3,
  ten_vai_tro: 'NHAN_VIEN_PHONG_VE',
  ma_chi_nhanh: 1,
  ten_chi_nhanh: 'Phương Trang Miền Tây',
  ho_va_ten: 'Nguyễn Thị Bán Vé',
  so_dien_thoai: '0901234567',
  email: 've@example.com',
  trang_thai_tai_khoan: 'HOAT_DONG',
  thoi_gian_tao: '2026-10-21T08:00:00.000Z',
  mat_khau_ma_hoa: 'hash',
};

function createRepository(overrides: Partial<UserRepositoryPort> = {}): UserRepositoryPort {
  return Object.assign(
    {
      list: vi.fn(async () => ({ items: [STAFF], total: 1 })),
      findById: vi.fn(async () => STAFF),
      phoneExists: vi.fn(async () => false),
      emailExists: vi.fn(async () => false),
      findRoleById: vi.fn(async () => ({
        ma_vai_tro: 3,
        ten_vai_tro: 'NHAN_VIEN_PHONG_VE' as const,
        mo_ta: null,
      })),
      findBranchById: vi.fn(async () => ({
        ma_chi_nhanh: 1,
        ma_dinh_danh: 'PV_MIEN_TAY',
        ten_chi_nhanh: 'Phương Trang Miền Tây',
        trang_thai_hoat_dong: true,
      })),
      listRoles: vi.fn(async () => []),
      create: vi.fn(async () => '10'),
      update: vi.fn(async () => undefined),
      updatePassword: vi.fn(async () => undefined),
      delete: vi.fn(async () => true),
      hasReferences: vi.fn(async () => false),
    } satisfies UserRepositoryPort,
    overrides,
  );
}

function passwordService(): PasswordService {
  return {
    hash: vi.fn(async () => 'hashed-password'),
    verify: vi.fn(async () => true),
  } as unknown as PasswordService;
}

describe('UserService', () => {
  it('ép nhân viên chi nhánh tạo người dùng vào đúng chi nhánh của mình', async () => {
    const repository = createRepository();
    const service = new UserService(repository, passwordService());

    const created = await service.create(
      {
        ma_vai_tro: 3,
        ho_va_ten: 'Nguyễn Thị Bán Vé',
        so_dien_thoai: '0901234567',
        email: 've@example.com',
        mat_khau: 'MatKhau@123',
      },
      { all: false, ma_chi_nhanh: 1 },
    );

    expect(created.ma_nguoi_dung).toBe('10');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ma_chi_nhanh: 1,
        mat_khau_ma_hoa: 'hashed-password',
        trang_thai_tai_khoan: 'HOAT_DONG',
      }),
      {},
    );
  });

  it('chặn quản lý chi nhánh gán người dùng sang chi nhánh khác', async () => {
    const repository = createRepository();
    const service = new UserService(repository, passwordService());

    await expect(
      service.create(
        {
          ma_vai_tro: 3,
          ma_chi_nhanh: 2,
          ho_va_ten: 'Nguyễn Thị Bán Vé',
          so_dien_thoai: '0901234567',
          mat_khau: 'MatKhau@123',
        },
        { all: false, ma_chi_nhanh: 1 },
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.FORBIDDEN });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('chặn quản lý chi nhánh gán vai trò quản trị viên', async () => {
    const repository = createRepository({
      findRoleById: vi.fn(async () => ({
        ma_vai_tro: 1,
        ten_vai_tro: 'QUAN_TRI_VIEN' as const,
        mo_ta: null,
      })),
    });
    const service = new UserService(repository, passwordService());

    await expect(
      service.create(
        {
          ma_vai_tro: 1,
          ho_va_ten: 'Quản trị viên mới',
          so_dien_thoai: '0901234567',
          mat_khau: 'MatKhau@123',
        },
        { all: false, ma_chi_nhanh: 1 },
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.FORBIDDEN });
  });

  it('cho phép quản trị viên tạo tài xế gắn chi nhánh', async () => {
    const repository = createRepository({
      findRoleById: vi.fn(async () => ({
        ma_vai_tro: 5,
        ten_vai_tro: 'TAI_XE' as const,
        mo_ta: null,
      })),
    });
    const service = new UserService(repository, passwordService());

    await service.create(
      {
        ma_vai_tro: 5,
        ma_chi_nhanh: 1,
        ho_va_ten: 'Tài xế mới',
        so_dien_thoai: '0912345678',
        mat_khau: 'MatKhau@123',
      },
      { all: true, ma_chi_nhanh: null },
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ma_vai_tro: 5,
        ma_chi_nhanh: 1,
      }),
      {},
    );
  });

  it('cho phép quản trị viên tạo khách hàng không gắn chi nhánh', async () => {
    const repository = createRepository({
      findRoleById: vi.fn(async () => ({
        ma_vai_tro: 6,
        ten_vai_tro: 'KHACH_HANG' as const,
        mo_ta: null,
      })),
    });
    const service = new UserService(repository, passwordService());

    await service.create(
      {
        ma_vai_tro: 6,
        ho_va_ten: 'Khách hàng mới',
        so_dien_thoai: '0912345679',
        mat_khau: 'MatKhau@123',
      },
      { all: true, ma_chi_nhanh: null },
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ma_vai_tro: 6,
        ma_chi_nhanh: null,
      }),
      {},
    );
  });

  it.each([
    { roleId: 5, role: 'TAI_XE' },
    { roleId: 6, role: 'KHACH_HANG' },
  ])('cho phép lọc danh sách theo vai trò $role', async ({ roleId }) => {
    const repository = createRepository();
    const service = new UserService(repository, passwordService());

    await service.list({ ma_vai_tro: roleId }, { all: true, ma_chi_nhanh: null });

    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({ ma_vai_tro: roleId }));
  });

  it('không cho người dùng tự khóa tài khoản đang đăng nhập', async () => {
    const repository = createRepository();
    const service = new UserService(repository, passwordService());

    await expect(
      service.changeStatus('10', 'KHOA', { all: true, ma_chi_nhanh: null }, '10'),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('chặn xóa người dùng đã phát sinh dữ liệu nghiệp vụ', async () => {
    const repository = createRepository({ hasReferences: vi.fn(async () => true) });
    const service = new UserService(repository, passwordService());

    await expect(
      service.delete('10', { all: true, ma_chi_nhanh: null }, '1'),
    ).rejects.toMatchObject({ code: ERROR_CODES.USER_IN_USE });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('chặn xem người dùng chi nhánh khác', async () => {
    const repository = createRepository();
    const service = new UserService(repository, passwordService());

    await expect(service.getById('10', { all: false, ma_chi_nhanh: 2 })).rejects.toMatchObject({
      code: ERROR_CODES.FORBIDDEN,
    });
  });
});
