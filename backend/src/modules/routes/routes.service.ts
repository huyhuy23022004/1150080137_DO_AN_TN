import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { HTTP_STATUS } from '../../common/http-status';
import { withTransaction } from '../../db/transaction';
import { normalizeMoney } from '../../utils/money';
import { buildPaginationMeta, resolvePagination } from '../../utils/pagination';
import {
  STOP_TYPE_VALUES,
  type CreateRouteInput,
  type RouteListFilters,
  type RouteRecord,
  type RouteRepositoryPort,
  type RouteStopInput,
  type StopType,
  type UpdateRouteInput,
} from './routes.types';

function stopsError(message: string): AppError {
  return new AppError(HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.ROUTE_STOPS_INVALID, message);
}

function validateStops(stops: RouteStopInput[]): RouteStopInput[] {
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 50) {
    throw stopsError('Tuyến đường phải có từ 2 đến 50 điểm dừng');
  }

  const orders = new Set<number>();
  const normalized: RouteStopInput[] = [];

  for (const stop of stops) {
    const name = stop.ten_diem_dung.trim();
    if (name.length < 2 || name.length > 150) {
      throw stopsError('Tên điểm dừng phải có từ 2 đến 150 ký tự');
    }

    if (stop.dia_chi !== null && stop.dia_chi.trim().length > 255) {
      throw stopsError('Địa chỉ điểm dừng không được vượt quá 255 ký tự');
    }

    if (!STOP_TYPE_VALUES.includes(stop.loai_diem)) {
      throw stopsError('Loại điểm dừng phải là DON, TRA hoặc TRUNG_CHUYEN');
    }

    if (!Number.isInteger(stop.thu_tu_dung) || stop.thu_tu_dung < 1) {
      throw stopsError('Thứ tự điểm dừng phải là số nguyên dương');
    }

    if (orders.has(stop.thu_tu_dung)) {
      throw stopsError(`Thứ tự điểm dừng ${stop.thu_tu_dung} bị trùng`);
    }
    orders.add(stop.thu_tu_dung);

    normalized.push({
      ten_diem_dung: name,
      dia_chi: stop.dia_chi?.trim() || null,
      loai_diem: stop.loai_diem as StopType,
      thu_tu_dung: stop.thu_tu_dung,
    });
  }

  if (!normalized.some((stop) => stop.loai_diem === 'DON')) {
    throw stopsError('Tuyến đường phải có ít nhất một điểm đón (DON)');
  }

  if (!normalized.some((stop) => stop.loai_diem === 'TRA')) {
    throw stopsError('Tuyến đường phải có ít nhất một điểm trả (TRA)');
  }

  return normalized.sort((left, right) => left.thu_tu_dung - right.thu_tu_dung);
}

function normalizeDistance(value: string | number): string {
  const distance = normalizeMoney(value);
  if (distance === '0.00' || Number(distance) > 9_999.99) {
    throw new AppError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      'Khoảng cách phải lớn hơn 0 và không vượt quá 9999.99 km',
    );
  }

  return distance;
}

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
    'Trạng thái tuyến đường không hợp lệ',
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

export interface RouteListResult {
  items: RouteRecord[];
  meta: ReturnType<typeof buildPaginationMeta>;
}

export class RouteService {
  public constructor(private readonly repository: RouteRepositoryPort) {}

  public async list(query: {
    q?: string;
    tinh_di?: string;
    tinh_den?: string;
    trang_thai?: string;
    page?: unknown;
    limit?: unknown;
  }): Promise<RouteListResult> {
    const pagination = resolvePagination(query.page, query.limit);
    const filters: RouteListFilters = {
      q: query.q?.trim() || null,
      tinh_di: query.tinh_di?.trim() || null,
      tinh_den: query.tinh_den?.trim() || null,
      trang_thai: parseStatusFilter(query.trang_thai),
      pagination,
    };

    const result = await this.repository.list(filters);

    return {
      items: result.items,
      meta: buildPaginationMeta(result.total, pagination),
    };
  }

  public async getById(id: number): Promise<RouteRecord> {
    const route = await this.repository.findById(id);
    if (!route) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.ROUTE_NOT_FOUND,
        'Không tìm thấy tuyến đường',
      );
    }

    return route;
  }

  public async create(input: CreateRouteInput): Promise<RouteRecord> {
    const name = input.ten_tuyen.trim();
    const stops = validateStops(input.diem_dung);
    const distance = normalizeDistance(input.khoang_cach_km);

    if (await this.repository.nameExists(name)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.ROUTE_NAME_EXISTS,
        'Tên tuyến đường đã tồn tại',
      );
    }

    return withTransaction(async (connection) => {
      const id = await this.repository.create(
        {
          ten_tuyen: name,
          tinh_di: input.tinh_di.trim(),
          tinh_den: input.tinh_den.trim(),
          khoang_cach_km: distance,
          thoi_gian_chay_du_kien: input.thoi_gian_chay_du_kien,
          trang_thai: normalizeStatus(input.trang_thai),
        },
        connection,
      );

      await this.repository.replaceStops(id, stops, connection);

      const created = await this.repository.findById(id, connection);
      if (!created) {
        throw new Error('Route was created but could not be reloaded');
      }

      return created;
    });
  }

  public async update(id: number, input: UpdateRouteInput): Promise<RouteRecord> {
    await this.getById(id);
    const name = input.ten_tuyen.trim();
    const distance = normalizeDistance(input.khoang_cach_km);

    if (await this.repository.nameExists(name, id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.ROUTE_NAME_EXISTS,
        'Tên tuyến đường đã tồn tại',
      );
    }

    const replacementStops = input.diem_dung === undefined ? null : validateStops(input.diem_dung);

    if (
      replacementStops !== null &&
      ((await this.repository.hasTrips(id)) || (await this.repository.hasOrders(id)))
    ) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.ROUTE_IN_USE,
        'Không thể thay đổi điểm dừng vì tuyến đã phát sinh chuyến xe hoặc đơn đặt vé',
      );
    }

    return withTransaction(async (connection) => {
      await this.repository.update(
        id,
        {
          ten_tuyen: name,
          tinh_di: input.tinh_di.trim(),
          tinh_den: input.tinh_den.trim(),
          khoang_cach_km: distance,
          thoi_gian_chay_du_kien: input.thoi_gian_chay_du_kien,
          trang_thai: normalizeStatus(input.trang_thai),
        },
        connection,
      );

      if (replacementStops !== null) {
        await this.repository.replaceStops(id, replacementStops, connection);
      }

      const updated = await this.repository.findById(id, connection);
      if (!updated) {
        throw new Error('Route was updated but could not be reloaded');
      }

      return updated;
    });
  }

  public async delete(id: number): Promise<void> {
    await this.getById(id);

    if (await this.repository.hasTrips(id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.ROUTE_IN_USE,
        'Không thể xóa tuyến đường đang có chuyến xe',
      );
    }

    if (await this.repository.hasOrders(id)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.ROUTE_IN_USE,
        'Không thể xóa tuyến đường đã phát sinh đơn đặt vé',
      );
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.ROUTE_NOT_FOUND,
        'Không tìm thấy tuyến đường',
      );
    }
  }
}
