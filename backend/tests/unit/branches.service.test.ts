import { describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '../../src/common/errors/error-codes';
import { BranchService } from '../../src/modules/branches/branches.service';
import type { BranchRecord, BranchRepositoryPort } from '../../src/modules/branches/branches.types';

vi.mock('../../src/db/transaction', () => ({
  withTransaction: async <T>(work: (connection: object) => Promise<T>): Promise<T> => work({}),
}));

const BRANCH: BranchRecord = {
  ma_chi_nhanh: 1,
  ma_dinh_danh: 'PV_MIEN_TAY',
  ten_chi_nhanh: 'Phương Trang Miền Tây',
  so_dien_thoai: '0901234567',
  dia_chi: '395 Kinh Dương Vương',
  tinh_thanh: 'TP. Hồ Chí Minh',
  trang_thai_hoat_dong: true,
};

function createRepository(overrides: Partial<BranchRepositoryPort> = {}): BranchRepositoryPort {
  return Object.assign(
    {
      list: vi.fn(async () => ({ items: [BRANCH], total: 1 })),
      findById: vi.fn(async () => BRANCH),
      codeExists: vi.fn(async () => false),
      phoneExists: vi.fn(async () => false),
      create: vi.fn(async () => 1),
      update: vi.fn(async () => undefined),
      delete: vi.fn(async () => true),
      hasUsers: vi.fn(async () => false),
      hasOrders: vi.fn(async () => false),
    } satisfies BranchRepositoryPort,
    overrides,
  );
}

describe('BranchService', () => {
  it('chuẩn hóa mã và số điện thoại khi tạo chi nhánh', async () => {
    const repository = createRepository();
    const service = new BranchService(repository);

    const created = await service.create({
      ma_dinh_danh: ' pv_mien_tay ',
      ten_chi_nhanh: 'Phương Trang Miền Tây',
      so_dien_thoai: '+84901234567',
      dia_chi: '395 Kinh Dương Vương',
      tinh_thanh: 'TP. Hồ Chí Minh',
      trang_thai_hoat_dong: true,
    });

    expect(created.ma_chi_nhanh).toBe(1);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ma_dinh_danh: 'PV_MIEN_TAY',
        so_dien_thoai: '0901234567',
      }),
      {},
    );
  });

  it('chặn mã định danh trùng', async () => {
    const repository = createRepository({ codeExists: vi.fn(async () => true) });
    const service = new BranchService(repository);

    await expect(
      service.create({
        ma_dinh_danh: 'PV_MIEN_TAY',
        ten_chi_nhanh: 'Chi nhánh khác',
        so_dien_thoai: '0901234567',
        dia_chi: 'Địa chỉ',
        tinh_thanh: 'TP. Hồ Chí Minh',
        trang_thai_hoat_dong: true,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.BRANCH_CODE_EXISTS });
  });

  it('chặn xóa chi nhánh đang có người dùng', async () => {
    const repository = createRepository({ hasUsers: vi.fn(async () => true) });
    const service = new BranchService(repository);

    await expect(service.delete(1)).rejects.toMatchObject({
      code: ERROR_CODES.BRANCH_IN_USE,
    });
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
