import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { HTTP_STATUS } from '../../common/http-status';
import { buildPaginationMeta, resolvePagination } from '../../utils/pagination';
import type {
  CreateVehicleInput,
  VehicleListFilters,
  VehicleRecord,
  VehicleRepositoryPort,
  VehicleStatus,
} from './vehicles.types';
import { VEHICLE_STATUSES } from './vehicles.types';

function normalizePlate(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeStatus(value: string | undefined): VehicleStatus {
  const status = (value ?? 'HOAT_DONG') as VehicleStatus;

  if (!VEHICLE_STATUSES.includes(status)) {
    throw new AppError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      'Trạng thái xe không hợp lệ',
    );
  }

  return status;
}

export interface VehicleListResult {
  items: VehicleRecord[];
  meta: ReturnType<typeof buildPaginationMeta>;
}

export class VehicleService {
  public constructor(private readonly repository: VehicleRepositoryPort) {}

  public async list(query: {
    q?: string;
    ma_loai_xe?: unknown;
    trang_thai?: string;
    page?: unknown;
    limit?: unknown;
  }): Promise<VehicleListResult> {
    const pagination = resolvePagination(query.page, query.limit);
    const typeId = query.ma_loai_xe === undefined ? null : Number(query.ma_loai_xe);
    const status =
      query.trang_thai !== undefined && VEHICLE_STATUSES.includes(query.trang_thai as VehicleStatus)
        ? (query.trang_thai as VehicleStatus)
        : null;

    const filters: VehicleListFilters = {
      q: query.q?.trim() || null,
      ma_loai_xe: Number.isInteger(typeId) && typeId !== null && typeId > 0 ? typeId : null,
      trang_thai: status,
      pagination,
    };

    const result = await this.repository.list(filters);

    return {
      items: result.items,
      meta: buildPaginationMeta(result.total, pagination),
    };
  }

  public async getById(id: number): Promise<VehicleRecord> {
    const vehicle = await this.repository.findById(id);
    if (!vehicle) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.VEHICLE_NOT_FOUND, 'Không tìm thấy xe');
    }

    return vehicle;
  }

  public async create(input: {
    ma_loai_xe: number;
    bien_so_xe: string;
    hang_san_xuat?: string | null;
    trang_thai?: string;
  }): Promise<VehicleRecord> {
    const plate = normalizePlate(input.bien_so_xe);
    const status = normalizeStatus(input.trang_thai);

    if (!(await this.repository.vehicleTypeExists(input.ma_loai_xe))) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VEHICLE_TYPE_NOT_FOUND,
        'Loại xe không tồn tại',
      );
    }

    if (await this.repository.plateExists(plate)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VEHICLE_PLATE_EXISTS,
        'Biển số xe đã tồn tại',
      );
    }

    const id = await this.repository.create({
      ma_loai_xe: input.ma_loai_xe,
      bien_so_xe: plate,
      hang_san_xuat: input.hang_san_xuat?.trim() || null,
      trang_thai: status,
    });

    return this.getById(id);
  }

  public async update(
    id: number,
    input: {
      ma_loai_xe: number;
      bien_so_xe: string;
      hang_san_xuat?: string | null;
      trang_thai?: string;
    },
  ): Promise<VehicleRecord> {
    await this.getById(id);
    const plate = normalizePlate(input.bien_so_xe);
    const status = normalizeStatus(input.trang_thai);

    if (!(await this.repository.vehicleTypeExists(input.ma_loai_xe))) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VEHICLE_TYPE_NOT_FOUND,
        'Loại xe không tồn tại',
      );
    }

    if (await this.repository.plateExists(plate, id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VEHICLE_PLATE_EXISTS,
        'Biển số xe đã tồn tại',
      );
    }

    const update: CreateVehicleInput = {
      ma_loai_xe: input.ma_loai_xe,
      bien_so_xe: plate,
      hang_san_xuat: input.hang_san_xuat?.trim() || null,
      trang_thai: status,
    };

    await this.repository.update(id, update);
    return this.getById(id);
  }

  public async delete(id: number): Promise<void> {
    await this.getById(id);

    if (await this.repository.hasTrips(id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VEHICLE_IN_USE,
        'Không thể xóa xe đang được phân công cho chuyến',
      );
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.VEHICLE_NOT_FOUND, 'Không tìm thấy xe');
    }
  }
}
