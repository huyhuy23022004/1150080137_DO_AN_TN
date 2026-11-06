import type { PoolConnection } from 'mysql2/promise';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { HTTP_STATUS } from '../../common/http-status';
import { withTransaction } from '../../db/transaction';
import {
  hasTimezoneOffset,
  nowDatabaseDateTime,
  toDatabaseDateTime,
  toIsoUtc,
  vietnamDayRange,
} from '../../utils/datetime';
import { normalizeMoney } from '../../utils/money';
import { buildPaginationMeta, resolvePagination } from '../../utils/pagination';
import {
  TRIP_STATUS,
  TRIP_STATUS_VALUES,
  type TripDetailRecord,
  type TripListFilters,
  type TripRecord,
  type TripRepositoryPort,
  type TripSeatMap,
  type TripStatus,
} from './trips.types';

export interface TripServiceScope {
  all: boolean;
  ma_chi_nhanh: number | null;
}

export interface SeatHoldInspector {
  getActiveSeatCodes(tripId: number): Promise<Set<string>>;
}

const DEFAULT_SEARCH_DAYS = 30;
const MAX_TRIP_DURATION_MINUTES = 72 * 60;

function invalidTime(message: string): AppError {
  return new AppError(HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.TRIP_TIME_INVALID, message);
}

function normalizeTripStatus(value: string | undefined): TripStatus {
  const status = (value ?? TRIP_STATUS.SAP_CHAY) as TripStatus;

  if (!TRIP_STATUS_VALUES.includes(status)) {
    throw new AppError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      'Trạng thái chuyến không hợp lệ',
    );
  }

  return status;
}

function parseTimes(startValue: string, endValue: string): { start: string; end: string } {
  if (!hasTimezoneOffset(startValue) || !hasTimezoneOffset(endValue)) {
    throw invalidTime('Thời gian xuất bến và đến dự kiến phải có múi giờ (ví dụ +07:00 hoặc Z)');
  }

  const startDate = new Date(startValue);
  const endDate = new Date(endValue);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw invalidTime('Thời gian chuyến xe không hợp lệ');
  }

  const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60_000;
  if (durationMinutes <= 0) {
    throw invalidTime('Thời gian đến dự kiến phải sau thời gian xuất bến');
  }

  if (durationMinutes > MAX_TRIP_DURATION_MINUTES) {
    throw invalidTime('Thời lượng chuyến xe không được vượt quá 72 giờ');
  }

  return {
    start: toDatabaseDateTime(startDate),
    end: toDatabaseDateTime(endDate),
  };
}

function parsePrice(value: string | number): string {
  let price: string;

  try {
    price = normalizeMoney(value);
  } catch {
    throw new AppError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      'Giá vé không hợp lệ',
    );
  }

  if (price === '0.00') {
    throw new AppError(
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      'Giá vé phải lớn hơn 0',
    );
  }

  return price;
}

function normalizeScope(scope: TripServiceScope | undefined): TripServiceScope {
  return scope ?? { all: true, ma_chi_nhanh: null };
}

function ensureBranchScope(record: TripRecord, scope: TripServiceScope): void {
  if (
    !scope.all &&
    (scope.ma_chi_nhanh === null || record.ma_chi_nhanh_tai_xe !== scope.ma_chi_nhanh)
  ) {
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.FORBIDDEN,
      'Bạn không có quyền quản lý chuyến xe của chi nhánh khác',
    );
  }
}

const ALLOWED_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  SAP_CHAY: [TRIP_STATUS.DANG_CHAY, TRIP_STATUS.HUY],
  DANG_CHAY: [TRIP_STATUS.HOAN_THANH],
  HOAN_THANH: [],
  HUY: [],
};

export interface TripListResult {
  items: TripRecord[];
  meta: ReturnType<typeof buildPaginationMeta>;
}

export class TripService {
  public constructor(
    private readonly repository: TripRepositoryPort,
    private readonly seatHoldInspector?: SeatHoldInspector,
  ) {}

  public async search(query: {
    tinh_di?: string;
    tinh_den?: string;
    ma_tuyen?: unknown;
    ngay?: string;
    page?: unknown;
    limit?: unknown;
  }): Promise<TripListResult> {
    const pagination = resolvePagination(query.page, query.limit);
    const now = nowDatabaseDateTime();
    let startUtc: string;
    let endUtc: string;

    if (query.ngay) {
      const range = vietnamDayRange(query.ngay);
      startUtc = range.start < now ? now : range.start;
      endUtc = range.end;
    } else {
      startUtc = now;
      endUtc = toDatabaseDateTime(new Date(Date.now() + DEFAULT_SEARCH_DAYS * 86_400_000));
    }

    const filters: TripListFilters = {
      tinh_di: query.tinh_di?.trim() || null,
      tinh_den: query.tinh_den?.trim() || null,
      ma_tuyen: this.parseOptionalId(query.ma_tuyen),
      ma_xe: null,
      ma_tai_xe: null,
      branchId: null,
      trang_thai: null,
      startUtc,
      endUtc,
      pagination,
    };

    const result = await this.repository.search(filters);
    return {
      items: result.items,
      meta: buildPaginationMeta(result.total, pagination),
    };
  }

  public async list(
    query: {
      tinh_di?: string;
      tinh_den?: string;
      ma_tuyen?: unknown;
      ma_xe?: unknown;
      ma_tai_xe?: string;
      trang_thai?: string;
      tu_ngay?: string;
      den_ngay?: string;
      page?: unknown;
      limit?: unknown;
    },
    scopeValue?: TripServiceScope,
  ): Promise<TripListResult> {
    const scope = normalizeScope(scopeValue);
    const pagination = resolvePagination(query.page, query.limit);

    if (!scope.all && scope.ma_chi_nhanh === null) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        'Tài khoản chưa được gán chi nhánh',
      );
    }

    let startUtc: string | null = null;
    let endUtc: string | null = null;

    if (query.tu_ngay) {
      startUtc = vietnamDayRange(query.tu_ngay).start;
    }

    if (query.den_ngay) {
      endUtc = vietnamDayRange(query.den_ngay).end;
    }

    const filters: TripListFilters = {
      tinh_di: query.tinh_di?.trim() || null,
      tinh_den: query.tinh_den?.trim() || null,
      ma_tuyen: this.parseOptionalId(query.ma_tuyen),
      ma_xe: this.parseOptionalId(query.ma_xe),
      ma_tai_xe: query.ma_tai_xe?.trim() || null,
      branchId: scope.all ? null : scope.ma_chi_nhanh,
      trang_thai: query.trang_thai === undefined ? null : (query.trang_thai as TripStatus),
      startUtc,
      endUtc,
      pagination,
    };

    if (filters.trang_thai !== null && !TRIP_STATUS_VALUES.includes(filters.trang_thai)) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Trạng thái chuyến không hợp lệ',
      );
    }

    const result = await this.repository.list(filters);
    return {
      items: result.items,
      meta: buildPaginationMeta(result.total, pagination),
    };
  }

  public async listAssignedToDriver(
    driverId: string,
    query: {
      trang_thai?: string;
      tu_ngay?: string;
      den_ngay?: string;
      page?: unknown;
      limit?: unknown;
    },
  ): Promise<TripListResult> {
    if (!driverId) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.AUTH_TOKEN_MISSING,
        'Không xác định được tài xế',
      );
    }

    const pagination = resolvePagination(query.page, query.limit);
    const status = query.trang_thai === undefined ? null : (query.trang_thai as TripStatus);

    if (status !== null && !TRIP_STATUS_VALUES.includes(status)) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Trạng thái chuyến không hợp lệ',
      );
    }

    const filters: TripListFilters = {
      tinh_di: null,
      tinh_den: null,
      ma_tuyen: null,
      ma_xe: null,
      ma_tai_xe: driverId,
      branchId: null,
      trang_thai: status,
      startUtc: query.tu_ngay ? vietnamDayRange(query.tu_ngay).start : null,
      endUtc: query.den_ngay ? vietnamDayRange(query.den_ngay).end : null,
      pagination,
    };

    const result = await this.repository.list(filters);
    return {
      items: result.items,
      meta: buildPaginationMeta(result.total, pagination),
    };
  }

  public async getById(id: number): Promise<TripDetailRecord> {
    const trip = await this.repository.findById(id);
    if (!trip) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.TRIP_NOT_FOUND,
        'Không tìm thấy chuyến xe',
      );
    }

    return this.attachStops(trip);
  }

  public async getManagedById(
    id: number,
    scopeValue?: TripServiceScope,
  ): Promise<TripDetailRecord> {
    const trip = await this.getById(id);
    ensureBranchScope(trip, normalizeScope(scopeValue));
    return trip;
  }

  public async getPublicById(id: number): Promise<TripDetailRecord> {
    const trip = await this.getById(id);

    if (trip.trang_thai === TRIP_STATUS.HUY) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.TRIP_NOT_FOUND,
        'Không tìm thấy chuyến xe',
      );
    }

    return trip;
  }

  public async create(
    input: {
      ma_tuyen: number;
      ma_xe: number;
      ma_tai_xe: string | number;
      thoi_gian_xuat_ben: string;
      thoi_gian_den_du_kien: string;
      gia_ve_co_ban: string | number;
      trang_thai?: string;
    },
    scopeValue?: TripServiceScope,
  ): Promise<TripDetailRecord> {
    const scope = normalizeScope(scopeValue);
    const times = parseTimes(input.thoi_gian_xuat_ben, input.thoi_gian_den_du_kien);
    const price = parsePrice(input.gia_ve_co_ban);
    const status = normalizeTripStatus(input.trang_thai);
    const driverId = String(input.ma_tai_xe);

    if (status !== TRIP_STATUS.SAP_CHAY) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Chuyến xe mới phải ở trạng thái SAP_CHAY',
      );
    }

    return withTransaction(async (connection) => {
      await this.validateAssignment(
        connection,
        {
          ma_tuyen: input.ma_tuyen,
          ma_xe: input.ma_xe,
          ma_tai_xe: driverId,
          start: times.start,
          end: times.end,
        },
        scope,
        null,
      );

      const id = await this.repository.create(
        {
          ma_tuyen: input.ma_tuyen,
          ma_xe: input.ma_xe,
          ma_tai_xe: driverId,
          thoi_gian_xuat_ben: times.start,
          thoi_gian_den_du_kien: times.end,
          gia_ve_co_ban: price,
          trang_thai: status,
        },
        connection,
      );

      const created = await this.repository.findById(id, connection);
      if (!created) {
        throw new Error('Trip was created but could not be reloaded');
      }

      return this.attachStops(created);
    });
  }

  public async update(
    id: number,
    input: {
      ma_tuyen: number;
      ma_xe: number;
      ma_tai_xe: string | number;
      thoi_gian_xuat_ben: string;
      thoi_gian_den_du_kien: string;
      gia_ve_co_ban: string | number;
    },
    scopeValue?: TripServiceScope,
  ): Promise<TripDetailRecord> {
    const scope = normalizeScope(scopeValue);
    const times = parseTimes(input.thoi_gian_xuat_ben, input.thoi_gian_den_du_kien);
    const price = parsePrice(input.gia_ve_co_ban);
    const driverId = String(input.ma_tai_xe);

    return withTransaction(async (connection) => {
      const existing = await this.repository.lockTripRow(id, connection);
      if (!existing) {
        throw new AppError(
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.TRIP_NOT_FOUND,
          'Không tìm thấy chuyến xe',
        );
      }

      ensureBranchScope(existing, scope);

      if (existing.trang_thai !== TRIP_STATUS.SAP_CHAY) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.TRIP_INVALID_STATUS_TRANSITION,
          'Chỉ có thể cập nhật chuyến xe đang ở trạng thái SAP_CHAY',
        );
      }

      await this.validateAssignment(
        connection,
        {
          ma_tuyen: input.ma_tuyen,
          ma_xe: input.ma_xe,
          ma_tai_xe: driverId,
          start: times.start,
          end: times.end,
        },
        scope,
        id,
      );

      const ticketCount = await this.repository.countTickets(id, connection);
      const assignmentChanged =
        existing.ma_tuyen !== input.ma_tuyen ||
        existing.ma_xe !== input.ma_xe ||
        existing.ma_tai_xe !== driverId ||
        existing.thoi_gian_xuat_ben !== toIsoUtc(times.start) ||
        existing.thoi_gian_den_du_kien !== toIsoUtc(times.end);

      if (ticketCount > 0 && assignmentChanged) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.TRIP_IN_USE,
          'Không thể thay đổi lịch hoặc phân công vì chuyến đã phát sinh vé',
        );
      }

      await this.repository.update(
        id,
        {
          ma_tuyen: input.ma_tuyen,
          ma_xe: input.ma_xe,
          ma_tai_xe: driverId,
          thoi_gian_xuat_ben: times.start,
          thoi_gian_den_du_kien: times.end,
          gia_ve_co_ban: price,
        },
        connection,
      );

      const updated = await this.repository.findById(id, connection);
      if (!updated) {
        throw new Error('Trip was updated but could not be reloaded');
      }

      return this.attachStops(updated);
    });
  }

  public async changeStatus(
    id: number,
    statusValue: string,
    scopeValue?: TripServiceScope,
  ): Promise<TripDetailRecord> {
    const scope = normalizeScope(scopeValue);
    const status = normalizeTripStatus(statusValue);
    const existing = await this.getById(id);
    ensureBranchScope(existing, scope);

    if (existing.trang_thai === status) {
      return existing;
    }

    const allowed = ALLOWED_TRANSITIONS[existing.trang_thai];
    if (!allowed.includes(status)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TRIP_INVALID_STATUS_TRANSITION,
        `Không thể chuyển trạng thái từ ${existing.trang_thai} sang ${status}`,
      );
    }

    if (status === TRIP_STATUS.HUY && (await this.repository.countTickets(id)) > 0) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TRIP_IN_USE,
        'Không thể hủy chuyến đã phát sinh vé',
      );
    }

    await this.repository.updateStatus(id, status);
    return this.getById(id);
  }

  public async delete(id: number, scopeValue?: TripServiceScope): Promise<void> {
    const scope = normalizeScope(scopeValue);
    const existing = await this.getById(id);
    ensureBranchScope(existing, scope);

    if (
      existing.trang_thai === TRIP_STATUS.DANG_CHAY ||
      existing.trang_thai === TRIP_STATUS.HOAN_THANH
    ) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TRIP_IN_USE,
        'Không thể xóa chuyến đang chạy hoặc đã hoàn thành',
      );
    }

    if ((await this.repository.countTickets(id)) > 0) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TRIP_IN_USE,
        'Không thể xóa chuyến đã phát sinh vé',
      );
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.TRIP_NOT_FOUND,
        'Không tìm thấy chuyến xe',
      );
    }
  }

  public async getSeatMap(id: number): Promise<TripSeatMap> {
    const trip = await this.getPublicById(id);
    const [layout, bookedSeats, mirrorHeldSeats, redisHeldSeats] = await Promise.all([
      this.repository.findSeatLayout(trip.ma_loai_xe),
      this.repository.findBookedSeatCodes(id),
      this.repository.findHeldSeatCodes(id),
      this.seatHoldInspector
        ? this.seatHoldInspector.getActiveSeatCodes(id)
        : Promise.resolve(new Set<string>()),
    ]);

    const seats = layout.map((seat) => {
      let status: 'TRONG' | 'DANG_GIU' | 'DA_DAT' = 'TRONG';

      if (bookedSeats.has(seat.ky_hieu_ghe)) {
        status = 'DA_DAT';
      } else if (mirrorHeldSeats.has(seat.ky_hieu_ghe) || redisHeldSeats.has(seat.ky_hieu_ghe)) {
        status = 'DANG_GIU';
      }

      return { ...seat, trang_thai: status };
    });

    return {
      ma_chuyen: trip.ma_chuyen,
      ma_xe: trip.ma_xe,
      bien_so_xe: trip.bien_so_xe,
      ma_loai_xe: trip.ma_loai_xe,
      ten_loai_xe: trip.ten_loai_xe,
      tong_so_ghe: seats.length,
      so_ghe_trong: seats.filter((seat) => seat.trang_thai === 'TRONG').length,
      ghe: seats,
    };
  }

  private async validateAssignment(
    connection: PoolConnection,
    assignment: {
      ma_tuyen: number;
      ma_xe: number;
      ma_tai_xe: string;
      start: string;
      end: string;
    },
    scope: TripServiceScope,
    excludeId: number | null,
  ): Promise<void> {
    const route = await this.repository.lockRoute(assignment.ma_tuyen, connection);
    if (!route) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.ROUTE_NOT_FOUND,
        'Tuyến đường không tồn tại',
      );
    }

    if (!route.trang_thai) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.ROUTE_NOT_AVAILABLE,
        'Tuyến đường đang ngừng hoạt động',
      );
    }

    const vehicle = await this.repository.lockVehicle(assignment.ma_xe, connection);
    if (!vehicle) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VEHICLE_NOT_FOUND,
        'Xe không tồn tại',
      );
    }

    if (vehicle.trang_thai !== 'HOAT_DONG') {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VEHICLE_NOT_AVAILABLE,
        'Xe không ở trạng thái hoạt động',
      );
    }

    const driver = await this.repository.lockDriver(assignment.ma_tai_xe, connection);
    if (!driver || driver.ten_vai_tro !== 'TAI_XE' || driver.trang_thai_tai_khoan !== 'HOAT_DONG') {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.DRIVER_NOT_AVAILABLE,
        'Tài xế không tồn tại hoặc không khả dụng',
      );
    }

    if (!scope.all && driver.ma_chi_nhanh !== scope.ma_chi_nhanh) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        'Bạn chỉ được phân công tài xế thuộc chi nhánh của mình',
      );
    }

    const vehicleConflict = await this.repository.findVehicleConflict(
      assignment.ma_xe,
      assignment.start,
      assignment.end,
      excludeId,
      connection,
    );

    if (vehicleConflict !== null) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TRIP_VEHICLE_CONFLICT,
        'Xe đã được phân công cho chuyến khác trong khoảng thời gian này',
        { ma_chuyen: vehicleConflict },
      );
    }

    const driverConflict = await this.repository.findDriverConflict(
      assignment.ma_tai_xe,
      assignment.start,
      assignment.end,
      excludeId,
      connection,
    );

    if (driverConflict !== null) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TRIP_DRIVER_CONFLICT,
        'Tài xế đã được phân công cho chuyến khác trong khoảng thời gian này',
        { ma_chuyen: driverConflict },
      );
    }
  }

  private parseOptionalId(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private async attachStops(trip: TripRecord): Promise<TripDetailRecord> {
    const stops = await this.repository.findRouteStops(trip.ma_tuyen);
    return { ...trip, diem_dung: stops };
  }
}
