import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { HTTP_STATUS } from '../../common/http-status';
import { withTransaction } from '../../db/transaction';
import { buildPaginationMeta, resolvePagination } from '../../utils/pagination';
import {
  SEAT_TYPES,
  type SeatInput,
  type SeatType,
  type VehicleTypeRecord,
} from './vehicle-types.types';
import type { VehicleTypeRepositoryPort } from './vehicle-types.types';

const MAX_SEATS = 200;

function layoutError(message: string, details?: unknown): AppError {
  return new AppError(
    HTTP_STATUS.UNPROCESSABLE_ENTITY,
    ERROR_CODES.SEAT_LAYOUT_INVALID,
    message,
    details,
  );
}

function normalizeSeatCode(value: string): string {
  return value.trim().toUpperCase();
}

function validateLayout(seats: SeatInput[], soTang: number): SeatInput[] {
  if (!Number.isInteger(soTang) || soTang < 1 || soTang > 3) {
    throw layoutError('Số tầng phải nằm trong khoảng 1 đến 3');
  }

  if (!Array.isArray(seats) || seats.length === 0) {
    throw layoutError('Sơ đồ ghế phải có ít nhất 1 ghế');
  }

  if (seats.length > MAX_SEATS) {
    throw layoutError(`Sơ đồ ghế không được vượt quá ${MAX_SEATS} ghế`);
  }

  const codes = new Set<string>();
  const positions = new Set<string>();
  const normalizedSeats: SeatInput[] = [];

  for (const seat of seats) {
    const code = normalizeSeatCode(seat.ky_hieu_ghe);
    if (!/^[A-Z0-9_-]{1,10}$/.test(code)) {
      throw layoutError(`Ký hiệu ghế "${seat.ky_hieu_ghe}" không hợp lệ`);
    }

    if (codes.has(code)) {
      throw layoutError(`Ký hiệu ghế "${code}" bị trùng`);
    }
    codes.add(code);

    if (!Number.isInteger(seat.tang) || seat.tang < 1 || seat.tang > soTang) {
      throw layoutError(`Tầng của ghế "${code}" phải nằm trong khoảng 1 đến ${soTang}`);
    }

    if (
      !Number.isInteger(seat.hang) ||
      seat.hang < 1 ||
      seat.hang > 999 ||
      !Number.isInteger(seat.cot) ||
      seat.cot < 1 ||
      seat.cot > 999
    ) {
      throw layoutError(`Vị trí hàng/cột của ghế "${code}" không hợp lệ`);
    }

    const position = `${seat.tang}:${seat.hang}:${seat.cot}`;
    if (positions.has(position)) {
      throw layoutError(`Vị trí tầng ${seat.tang}, hàng ${seat.hang}, cột ${seat.cot} bị trùng`);
    }
    positions.add(position);

    if (seat.loai_cho !== SEAT_TYPES.THUONG && seat.loai_cho !== SEAT_TYPES.VIP) {
      throw layoutError(`Loại chỗ của ghế "${code}" không hợp lệ`);
    }

    normalizedSeats.push({
      ky_hieu_ghe: code,
      tang: seat.tang,
      hang: seat.hang,
      cot: seat.cot,
      loai_cho: seat.loai_cho as SeatType,
    });
  }

  return normalizedSeats.sort(
    (left, right) =>
      left.tang - right.tang ||
      left.hang - right.hang ||
      left.cot - right.cot ||
      left.ky_hieu_ghe.localeCompare(right.ky_hieu_ghe),
  );
}

export interface VehicleTypeListResult {
  items: VehicleTypeRecord[];
  meta: ReturnType<typeof buildPaginationMeta>;
}

export class VehicleTypeService {
  public constructor(private readonly repository: VehicleTypeRepositoryPort) {}

  public async list(query: {
    q?: string;
    page?: unknown;
    limit?: unknown;
  }): Promise<VehicleTypeListResult> {
    const pagination = resolvePagination(query.page, query.limit);
    const result = await this.repository.list({
      q: query.q?.trim() || null,
      pagination,
    });

    return {
      items: result.items,
      meta: buildPaginationMeta(result.total, pagination),
    };
  }

  public async getById(id: number): Promise<VehicleTypeRecord> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.VEHICLE_TYPE_NOT_FOUND,
        'Không tìm thấy loại xe',
      );
    }

    return record;
  }

  public async create(input: {
    ten_loai_xe: string;
    so_tang: number;
    so_do_ghe: SeatInput[];
  }): Promise<VehicleTypeRecord> {
    const name = input.ten_loai_xe.trim();
    const seats = validateLayout(input.so_do_ghe, input.so_tang);

    if (await this.repository.nameExists(name)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VEHICLE_TYPE_NAME_EXISTS,
        'Tên loại xe đã tồn tại',
      );
    }

    return withTransaction(async (connection) => {
      const id = await this.repository.create(
        {
          ten_loai_xe: name,
          so_tang: input.so_tang,
          tong_so_ghe: seats.length,
        },
        connection,
      );

      await this.repository.replaceSeats(id, seats, connection);

      const created = await this.repository.findById(id, connection);
      if (!created) {
        throw new Error('Vehicle type was created but could not be reloaded');
      }

      return created;
    });
  }

  public async update(
    id: number,
    input: { ten_loai_xe: string; so_tang: number; so_do_ghe?: SeatInput[] },
  ): Promise<VehicleTypeRecord> {
    const existing = await this.getById(id);
    const name = input.ten_loai_xe.trim();

    if (await this.repository.nameExists(name, id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VEHICLE_TYPE_NAME_EXISTS,
        'Tên loại xe đã tồn tại',
      );
    }

    const replacementSeats =
      input.so_do_ghe === undefined ? null : validateLayout(input.so_do_ghe, input.so_tang);

    if (replacementSeats === null && existing.so_do_ghe.some((seat) => seat.tang > input.so_tang)) {
      throw layoutError('Số tầng mới nhỏ hơn tầng của một số ghế hiện có');
    }

    const finalSeats = replacementSeats ?? existing.so_do_ghe;

    if (replacementSeats !== null && (await this.repository.hasTickets(id))) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VEHICLE_TYPE_IN_USE,
        'Không thể thay đổi sơ đồ ghế vì đã có vé sử dụng loại xe này',
      );
    }

    return withTransaction(async (connection) => {
      await this.repository.update(
        id,
        {
          ten_loai_xe: name,
          so_tang: input.so_tang,
          tong_so_ghe: finalSeats.length,
        },
        connection,
      );

      if (replacementSeats !== null) {
        await this.repository.replaceSeats(id, replacementSeats, connection);
      }

      const updated = await this.repository.findById(id, connection);
      if (!updated) {
        throw new Error('Vehicle type was updated but could not be reloaded');
      }

      return updated;
    });
  }

  public async delete(id: number): Promise<void> {
    await this.getById(id);

    if (await this.repository.hasVehicles(id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VEHICLE_TYPE_IN_USE,
        'Không thể xóa loại xe đang được sử dụng',
      );
    }

    if (await this.repository.hasTickets(id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.VEHICLE_TYPE_IN_USE,
        'Không thể xóa loại xe đã phát sinh vé',
      );
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.VEHICLE_TYPE_NOT_FOUND,
        'Không tìm thấy loại xe',
      );
    }
  }
}
