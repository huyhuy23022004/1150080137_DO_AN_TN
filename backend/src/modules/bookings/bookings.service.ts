import Decimal from 'decimal.js';
import { logger } from '../../config/logger';
import { config } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { getMySqlErrorCode } from '../../common/errors/db-errors';
import {
  CHI_TIET_VE_STATUS,
  DON_DAT_VE_STATUS,
  PHUONG_THUC_THANH_TOAN,
  ROLES,
  TRANG_THAI_THANH_TOAN,
  type PaymentMethod,
  type RoleName,
} from '../../common/constants';
import { HTTP_STATUS } from '../../common/http-status';
import { withTransaction } from '../../db/transaction';
import { toDatabaseDateTime, vietnamDayRange } from '../../utils/datetime';
import { createTicketQrToken } from '../../utils/qr-token';
import { buildPaginationMeta, resolvePagination } from '../../utils/pagination';
import { publishSeatBooked, publishSeatReleased } from '../../realtime/events';
import type {
  BookingActor,
  BookingCustomerProfile,
  BookingIdempotencyStorePort,
  BookingListFilters,
  BookingListItem,
  BookingListQuery,
  BookingListResult,
  BookingQuoteResult,
  BookingRecord,
  BookingRepositoryPort,
  BookingResult,
  BookingSeatInfo,
  BookingStopInfo,
  BookingTripInfo,
  CreateBookingInput,
  ExpiredBookingOrder,
} from './bookings.types';
import { scopedIdempotencyKey } from './booking-idempotency.store';
import type { OrderCodeGeneratorPort } from '../../utils/code-generator';
import type { SeatLockService } from '../seat-locks/seat-locks.service';

const STAFF_ROLES: readonly RoleName[] = [
  ROLES.QUAN_TRI_VIEN,
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.NHAN_VIEN_PHONG_VE,
  ROLES.DIEU_HANH,
];

const SALES_ROLES: readonly RoleName[] = [
  ROLES.QUAN_TRI_VIEN,
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.NHAN_VIEN_PHONG_VE,
];

const VISIT_ALL_ROLES: readonly RoleName[] = [ROLES.QUAN_TRI_VIEN, ROLES.DIEU_HANH];
const SEAT_CODE_PATTERN = /^[A-Z0-9_-]{1,10}$/;
const OWNER_REF_PATTERN = /^[A-Za-z0-9_-]{8,50}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
const BOOKING_CODE_PATTERN = /^[A-Za-z0-9-]{3,50}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BOOKING_STATUSES: readonly string[] = Object.values(DON_DAT_VE_STATUS);

export interface CustomerProfilePort {
  findUserById(userId: string): Promise<BookingCustomerProfile | null>;
}

export interface BookingServiceDependencies {
  repository: BookingRepositoryPort;
  seatLocks: SeatLockService;
  orderCodeGenerator: OrderCodeGeneratorPort;
  idempotencyStore: BookingIdempotencyStorePort;
  customerProfiles: CustomerProfilePort;
  paymentTimeoutMinutes?: number;
  idempotencyTtlSeconds?: number;
  maxSeatsPerOrder?: number;
  tripBookingCloseMinutes?: number;
  now?: () => Date;
}

export interface CreateBookingResult extends BookingResult {
  owner_ref: string;
}

function isStaffRole(role: RoleName): boolean {
  return STAFF_ROLES.includes(role);
}

function canSell(role: RoleName): boolean {
  return SALES_ROLES.includes(role);
}

function plusMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function validationError(message: string): AppError {
  return new AppError(HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.VALIDATION_ERROR, message);
}

function notFoundError(): AppError {
  return new AppError(
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.BOOKING_NOT_FOUND,
    'Không tìm thấy đơn đặt vé',
  );
}

export class BookingService {
  private readonly paymentTimeoutMinutes: number;
  private readonly idempotencyTtlSeconds: number;
  private readonly maxSeatsPerOrder: number;
  private readonly tripBookingCloseMinutes: number;
  private readonly now: () => Date;

  public constructor(private readonly dependencies: BookingServiceDependencies) {
    this.paymentTimeoutMinutes =
      dependencies.paymentTimeoutMinutes ?? config.booking.paymentTimeoutMinutes;
    this.idempotencyTtlSeconds =
      dependencies.idempotencyTtlSeconds ?? config.booking.idempotencyTtlSeconds;
    this.maxSeatsPerOrder = dependencies.maxSeatsPerOrder ?? config.booking.maxSeatsPerOrder;
    this.tripBookingCloseMinutes =
      dependencies.tripBookingCloseMinutes ?? config.booking.tripBookingCloseMinutes;
    this.now = dependencies.now ?? (() => new Date());
  }

  public async quote(tripId: number, seatCodesValue: string[]): Promise<BookingQuoteResult> {
    const seatCodes = this.normalizeSeats(seatCodesValue);
    const trip = await this.requireBookableTrip(tripId);
    const [seats, booked, held] = await Promise.all([
      this.dependencies.repository.findSeatsByCodes(tripId, seatCodes),
      this.dependencies.repository.findBookedSeatCodes(tripId, seatCodes),
      this.dependencies.seatLocks.getActiveSeatCodes(tripId),
    ]);

    this.ensureSeatsExist(seats, seatCodes);

    const seatByCode = new Map(seats.map((seat) => [seat.ky_hieu_ghe, seat]));
    const items = seatCodes.map((code) => {
      const seat = seatByCode.get(code) as BookingSeatInfo;
      const status = booked.has(code) ? 'DA_DAT' : held.has(code) ? 'DANG_GIU' : 'TRONG';

      return {
        ky_hieu_ghe: code,
        loai_cho: seat.loai_cho,
        gia_ve: trip.gia_ve_co_ban,
        trang_thai: status as 'TRONG' | 'DANG_GIU' | 'DA_DAT',
      };
    });

    const total = new Decimal(trip.gia_ve_co_ban).mul(seatCodes.length).toFixed(2);

    return {
      ma_chuyen: tripId,
      danh_sach_ghe: items,
      so_ghe_trong: items.filter((seat) => seat.trang_thai === 'TRONG').length,
      tong_tien: total,
      tien_te: 'VND',
    };
  }

  public async create(
    input: CreateBookingInput,
    actor: BookingActor,
  ): Promise<CreateBookingResult> {
    const ownerRef = this.normalizeOwnerRef(input.owner_ref);
    const seats = this.normalizeSeats(input.danh_sach_ghe);
    const tripId = this.parseTripId(input.ma_chuyen);
    const paymentMethod = input.phuong_thuc_thanh_toan ?? PHUONG_THUC_THANH_TOAN.TIEN_MAT;
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotency_key);

    const supportedPaymentMethods: PaymentMethod[] = [
      PHUONG_THUC_THANH_TOAN.TIEN_MAT,
      PHUONG_THUC_THANH_TOAN.VNPAY,
    ];

    if (!supportedPaymentMethods.includes(paymentMethod)) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.PAYMENT_METHOD_UNAVAILABLE,
        'Phương thức thanh toán không được hỗ trợ',
      );
    }

    const isStaff = isStaffRole(actor.ten_vai_tro);
    if (isStaff && !canSell(actor.ten_vai_tro)) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        'Tài khoản của bạn không có quyền bán vé',
      );
    }

    if (isStaff && !VISIT_ALL_ROLES.includes(actor.ten_vai_tro) && actor.ma_chi_nhanh === null) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        'Tài khoản chưa được gán chi nhánh',
      );
    }

    const customer = await this.resolveCustomer(input, actor, isStaff);
    const scopedKey = idempotencyKey ? scopedIdempotencyKey(ownerRef, idempotencyKey) : null;

    if (scopedKey) {
      const existing = await this.findByIdempotencyKey(scopedKey, actor, tripId, seats);
      if (existing) {
        return { ...this.withExpiry(existing), owner_ref: ownerRef };
      }
    }

    await this.dependencies.seatLocks.verifyForBooking(tripId, seats, ownerRef);

    const orderCode = await this.generateOrderCode();
    const paidImmediately = isStaff && paymentMethod === PHUONG_THUC_THANH_TOAN.TIEN_MAT;
    const orderStatus = paidImmediately
      ? DON_DAT_VE_STATUS.DA_THANH_TOAN
      : DON_DAT_VE_STATUS.CHO_THANH_TOAN;
    const paymentStatus = paidImmediately
      ? TRANG_THAI_THANH_TOAN.THANH_CONG
      : TRANG_THAI_THANH_TOAN.CHO_XU_LY;

    let order: BookingRecord;

    try {
      order = await withTransaction(async (connection) => {
        const trip = await this.dependencies.repository.findTripForBooking(
          tripId,
          connection,
          true,
        );

        if (!trip) {
          throw new AppError(
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.TRIP_NOT_FOUND,
            'Không tìm thấy chuyến xe',
          );
        }

        this.ensureBookable(trip);

        const [seatRows, booked, pickup, dropoff] = await Promise.all([
          this.dependencies.repository.findSeatsByCodes(tripId, seats, connection),
          this.dependencies.repository.findBookedSeatCodes(tripId, seats, connection),
          this.dependencies.repository.findRouteStop(input.ma_diem_don, connection),
          this.dependencies.repository.findRouteStop(input.ma_diem_tra, connection),
        ]);

        this.ensureSeatsExist(seatRows, seats);
        this.validateStops(trip, pickup, dropoff);

        if (booked.size > 0) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.BOOKING_SEAT_CONFLICT,
            'Một số ghế đã được bán cho đơn khác, vui lòng chọn ghế khác',
            { danh_sach_ghe: [...booked] },
          );
        }

        const total = new Decimal(trip.gia_ve_co_ban).mul(seats.length).toFixed(2);
        const orderId = await this.dependencies.repository.createOrder(
          {
            ma_dinh_danh_don: orderCode,
            ma_khach_hang: isStaff ? null : actor.ma_nguoi_dung,
            ho_ten_khach: customer.ho_va_ten,
            so_dien_thoai_khach: customer.so_dien_thoai,
            email_khach: customer.email,
            ma_nhan_vien_ban: isStaff ? actor.ma_nguoi_dung : null,
            ma_chi_nhanh_ban: isStaff ? actor.ma_chi_nhanh : null,
            ma_diem_don: input.ma_diem_don,
            ma_diem_tra: input.ma_diem_tra,
            tong_tien: total,
            trang_thai_don: orderStatus,
          },
          connection,
        );

        await this.dependencies.repository.createTickets(
          seats.map((seatCode) => {
            const seat = seatRows.find((item) => item.ky_hieu_ghe === seatCode);
            if (!seat) {
              throw new Error(`Missing seat ${seatCode} while creating tickets`);
            }

            return {
              ma_don_ve: orderId,
              ma_chuyen: tripId,
              ma_ghe: seat.ma_ghe,
              ky_hieu_ghe: seat.ky_hieu_ghe,
              gia_ve: trip.gia_ve_co_ban,
              ma_qr_kiem_tra: createTicketQrToken({
                ma_chuyen: tripId,
                ky_hieu_ghe: seat.ky_hieu_ghe,
              }),
              trang_thai_ve: CHI_TIET_VE_STATUS.HIEU_LUC,
            };
          }),
          connection,
        );

        await this.dependencies.repository.createPayment(
          {
            ma_don_ve: orderId,
            phuong_thuc: paymentMethod,
            so_tien: total,
            trang_thai: paymentStatus,
          },
          connection,
        );

        const created = await this.dependencies.repository.findOrderById(orderId, connection);
        if (!created) {
          throw new Error('Booking was created but could not be reloaded');
        }

        return created;
      });
    } catch (error) {
      throw this.mapBookingError(error);
    }

    await this.dependencies.seatLocks.consumeAfterBooking(tripId, seats, ownerRef);

    if (scopedKey) {
      try {
        await this.dependencies.idempotencyStore.set(
          scopedKey,
          order.ma_don_ve,
          this.idempotencyTtlSeconds,
        );
      } catch (error) {
        logger.warn({ err: error, orderId: order.ma_don_ve }, 'booking_idempotency_write_failed');
      }
    }

    publishSeatBooked({
      ma_chuyen: tripId,
      danh_sach_ghe: seats,
      ma_don_ve: order.ma_don_ve,
      owner_ref: ownerRef,
      trang_thai_don: order.trang_thai_don,
    });

    return { ...this.withExpiry(order), owner_ref: ownerRef };
  }

  public async list(query: BookingListQuery, actor: BookingActor): Promise<BookingListResult> {
    const { filters, pagination } = this.resolveListFilters(query, actor);
    const result = await this.dependencies.repository.list(filters);

    return {
      items: result.items.map((item): BookingListItem => ({
        ...item,
        thoi_gian_het_han: this.expiryFor(item.trang_thai_don, item.thoi_gian_tao),
      })),
      meta: buildPaginationMeta(result.total, pagination),
    };
  }

  public async getById(id: string, actor: BookingActor): Promise<BookingResult> {
    const order = await this.dependencies.repository.findOrderById(id);
    if (!order) {
      throw notFoundError();
    }

    this.ensureOrderAccess(order, actor);
    return this.withExpiry(order);
  }

  public async getByCode(codeValue: string, actor: BookingActor): Promise<BookingResult> {
    const code = String(codeValue ?? '')
      .trim()
      .toUpperCase();

    if (!BOOKING_CODE_PATTERN.test(code)) {
      throw validationError('Mã đơn đặt vé không hợp lệ');
    }

    const order = await this.dependencies.repository.findOrderByIdentifier(code);
    if (!order) {
      throw notFoundError();
    }

    this.ensureOrderAccess(order, actor);
    return this.withExpiry(order);
  }

  public async cancel(id: string, actor: BookingActor): Promise<BookingResult> {
    const cancelled = await withTransaction(async (connection) => {
      const order = await this.dependencies.repository.lockOrder(id, connection);
      if (!order) {
        throw notFoundError();
      }

      this.ensureOrderAccess(order, actor);

      if (order.trang_thai_don !== DON_DAT_VE_STATUS.CHO_THANH_TOAN) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.BOOKING_INVALID_STATUS,
          'Chỉ có thể hủy đơn đang chờ thanh toán',
        );
      }

      await this.dependencies.repository.cancelOrder(id, connection);
      const updated = await this.dependencies.repository.findOrderById(id, connection);
      if (!updated) {
        throw new Error('Booking was cancelled but could not be reloaded');
      }

      return updated;
    });

    this.publishReleased(
      {
        ma_chuyen: cancelled.ma_chuyen,
        danh_sach_ghe: cancelled.chi_tiet_ve.map((ticket) => ticket.ky_hieu_ghe),
      },
      'CANCELLED',
    );
    return this.withExpiry(cancelled);
  }

  public async confirmCash(id: string, actor: BookingActor): Promise<BookingResult> {
    if (!canSell(actor.ten_vai_tro)) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        'Bạn không có quyền xác nhận thanh toán',
      );
    }

    const confirmed = await withTransaction(async (connection) => {
      const order = await this.dependencies.repository.lockOrder(id, connection);
      if (!order) {
        throw notFoundError();
      }

      this.ensureOrderAccess(order, actor);

      if (order.trang_thai_don === DON_DAT_VE_STATUS.DA_THANH_TOAN) {
        return order;
      }

      if (order.trang_thai_don !== DON_DAT_VE_STATUS.CHO_THANH_TOAN) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.BOOKING_INVALID_STATUS,
          'Đơn đặt vé không ở trạng thái chờ thanh toán',
        );
      }

      const cashPayment = order.thanh_toan.find(
        (payment) =>
          payment.phuong_thuc === PHUONG_THUC_THANH_TOAN.TIEN_MAT &&
          payment.trang_thai === TRANG_THAI_THANH_TOAN.CHO_XU_LY,
      );

      if (!cashPayment) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.PAYMENT_NOT_FOUND,
          'Không tìm thấy giao dịch tiền mặt đang chờ xử lý',
        );
      }

      await this.dependencies.repository.confirmCashPayment(id, connection);
      const updated = await this.dependencies.repository.findOrderById(id, connection);
      if (!updated) {
        throw new Error('Payment was confirmed but booking could not be reloaded');
      }

      return updated;
    });

    if (confirmed.ma_chuyen !== null) {
      publishSeatBooked({
        ma_chuyen: confirmed.ma_chuyen,
        danh_sach_ghe: confirmed.chi_tiet_ve.map((ticket) => ticket.ky_hieu_ghe),
        ma_don_ve: confirmed.ma_don_ve,
        trang_thai_don: confirmed.trang_thai_don,
      });
    }

    return this.withExpiry(confirmed);
  }

  public async expirePendingOrders(limit = 50): Promise<ExpiredBookingOrder[]> {
    const cutoff = toDatabaseDateTime(
      new Date(this.now().getTime() - this.paymentTimeoutMinutes * 60_000),
    );
    const candidates = await this.dependencies.repository.findExpiredOrders(cutoff, limit);
    const expired: ExpiredBookingOrder[] = [];

    for (const candidate of candidates) {
      try {
        const order = await withTransaction(async (connection) => {
          const locked = await this.dependencies.repository.lockOrder(
            candidate.ma_don_ve,
            connection,
          );

          if (!locked || locked.trang_thai_don !== DON_DAT_VE_STATUS.CHO_THANH_TOAN) {
            return null;
          }

          await this.dependencies.repository.cancelOrder(candidate.ma_don_ve, connection);
          return locked;
        });

        if (!order) {
          continue;
        }

        this.publishReleased(candidate, 'BOOKING_EXPIRED');
        expired.push(candidate);
      } catch (error) {
        logger.error({ err: error, orderId: candidate.ma_don_ve }, 'booking_expiry_failed');
      }
    }

    return expired;
  }

  private async findByIdempotencyKey(
    scopedKey: string,
    actor: BookingActor,
    tripId: number,
    seats: string[],
  ): Promise<BookingRecord | null> {
    let orderId: string | null;

    try {
      orderId = await this.dependencies.idempotencyStore.get(scopedKey);
    } catch (error) {
      logger.error({ err: error }, 'booking_idempotency_read_failed');
      throw new AppError(
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Không thể kiểm tra mã chống trùng, vui lòng thử lại sau',
      );
    }

    if (!orderId) {
      return null;
    }

    const order = await this.dependencies.repository.findOrderById(orderId);
    if (!order) {
      await this.dependencies.idempotencyStore.delete(scopedKey).catch(() => undefined);
      return null;
    }

    this.ensureOrderAccess(order, actor);

    const existingSeats = order.chi_tiet_ve.map((ticket) => ticket.ky_hieu_ghe).sort();
    const requestedSeats = [...seats].sort();

    if (
      order.ma_chuyen !== tripId ||
      existingSeats.length !== requestedSeats.length ||
      existingSeats.some((seat, index) => seat !== requestedSeats[index])
    ) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.BOOKING_IDEMPOTENCY_CONFLICT,
        'Mã chống trùng đã được sử dụng cho một đơn đặt vé khác',
      );
    }

    return order;
  }

  private async resolveCustomer(
    input: CreateBookingInput,
    actor: BookingActor,
    isStaff: boolean,
  ): Promise<BookingCustomerProfile> {
    if (!isStaff) {
      const profile = await this.dependencies.customerProfiles.findUserById(actor.ma_nguoi_dung);
      if (!profile) {
        throw new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.AUTH_USER_NOT_FOUND,
          'Không tìm thấy tài khoản khách hàng',
        );
      }

      return {
        ho_va_ten: profile.ho_va_ten,
        so_dien_thoai: profile.so_dien_thoai,
        email: profile.email,
      };
    }

    const fullName = input.ho_ten_khach?.trim();
    const phone = input.so_dien_thoai_khach?.trim();

    if (!fullName || fullName.length > 100) {
      throw validationError('Họ tên khách là bắt buộc và tối đa 100 ký tự');
    }

    if (!phone || !/^0\d{9,10}$/.test(phone)) {
      throw validationError('Số điện thoại khách không hợp lệ');
    }

    return {
      ho_va_ten: fullName,
      so_dien_thoai: phone,
      email: input.email_khach?.trim() || null,
    };
  }

  private async requireBookableTrip(tripId: number): Promise<BookingTripInfo> {
    const trip = await this.dependencies.repository.findTripForBooking(tripId);
    if (!trip) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.TRIP_NOT_FOUND,
        'Không tìm thấy chuyến xe',
      );
    }

    this.ensureBookable(trip);
    return trip;
  }

  private ensureBookable(trip: BookingTripInfo): void {
    if (trip.trang_thai !== 'SAP_CHAY') {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TRIP_NOT_BOOKABLE,
        'Chuyến xe không ở trạng thái có thể đặt vé',
      );
    }

    const departure = new Date(trip.thoi_gian_xuat_ben).getTime();
    const cutoff = this.now().getTime() + this.tripBookingCloseMinutes * 60_000;

    if (Number.isNaN(departure) || departure <= cutoff) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TRIP_NOT_BOOKABLE,
        'Đã quá thời gian cho phép đặt vé cho chuyến xe này',
      );
    }
  }

  private ensureSeatsExist(seats: BookingSeatInfo[], requested: string[]): void {
    const found = new Set(seats.map((seat) => seat.ky_hieu_ghe));
    const missing = requested.filter((seat) => !found.has(seat));

    if (missing.length > 0) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.SEAT_NOT_FOUND,
        'Một số ghế không tồn tại trong sơ đồ của chuyến',
        { danh_sach_ghe: missing },
      );
    }
  }

  private validateStops(
    trip: BookingTripInfo,
    pickup: BookingStopInfo | null,
    dropoff: BookingStopInfo | null,
  ): void {
    if (!pickup || pickup.ma_tuyen !== trip.ma_tuyen || pickup.loai_diem !== 'DON') {
      throw validationError('Điểm đón không hợp lệ đối với tuyến của chuyến xe');
    }

    if (!dropoff || dropoff.ma_tuyen !== trip.ma_tuyen || dropoff.loai_diem !== 'TRA') {
      throw validationError('Điểm trả không hợp lệ đối với tuyến của chuyến xe');
    }

    if (pickup.thu_tu_dung >= dropoff.thu_tu_dung) {
      throw validationError('Điểm trả phải sau điểm đón trong lộ trình');
    }
  }

  private resolveListFilters(
    query: BookingListQuery,
    actor: BookingActor,
  ): {
    filters: BookingListFilters;
    pagination: ReturnType<typeof resolvePagination>;
  } {
    if (!isStaffRole(actor.ten_vai_tro)) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        'Bạn không có quyền tra cứu danh sách đơn đặt vé',
      );
    }

    let branchId = this.parseOptionalPositiveInt(query.ma_chi_nhanh, 'Mã chi nhánh không hợp lệ');
    let includeUnassignedBranch = false;

    if (!VISIT_ALL_ROLES.includes(actor.ten_vai_tro)) {
      if (actor.ma_chi_nhanh === null) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.FORBIDDEN,
          'Tài khoản chưa được gán chi nhánh',
        );
      }

      if (branchId !== null && branchId !== actor.ma_chi_nhanh) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.FORBIDDEN,
          'Bạn chỉ được tra cứu đơn đặt vé của chi nhánh mình',
        );
      }

      branchId = actor.ma_chi_nhanh;
      includeUnassignedBranch = true;
    }

    const q = this.parseOptionalText(query.q, 'Từ khóa', 100);
    const bookingCode = this.parseOptionalText(query.ma_dinh_danh_don, 'Mã đơn', 50);
    const customerPhone = this.parseOptionalText(
      query.so_dien_thoai_khach,
      'Số điện thoại khách',
      11,
    );

    if (customerPhone && !/^0\d{9,10}$/.test(customerPhone)) {
      throw validationError('Số điện thoại khách không hợp lệ');
    }

    const statusText = this.parseOptionalText(query.trang_thai_don, 'Trạng thái đơn', 30);
    const status = statusText ? statusText.toUpperCase() : null;

    if (status && !BOOKING_STATUSES.includes(status)) {
      throw validationError('Trạng thái đơn đặt vé không hợp lệ');
    }

    const maChuyen = this.parseOptionalPositiveInt(query.ma_chuyen, 'Mã chuyến không hợp lệ');
    const tuNgay = this.parseDateFilter(query.tu_ngay, 'Ngày bắt đầu');
    const denNgay = this.parseDateFilter(query.den_ngay, 'Ngày kết thúc');

    if (tuNgay && denNgay && tuNgay > denNgay) {
      throw validationError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
    }

    let startUtc: string | null = null;
    let endUtc: string | null = null;

    try {
      startUtc = tuNgay ? vietnamDayRange(tuNgay).start : null;
      endUtc = denNgay ? vietnamDayRange(denNgay).end : null;
    } catch {
      throw validationError('Khoảng thời gian không hợp lệ');
    }

    const pagination = resolvePagination(query.page, query.limit);

    return {
      filters: {
        q,
        ma_dinh_danh_don: bookingCode ? bookingCode.toUpperCase() : null,
        so_dien_thoai_khach: customerPhone,
        ma_chuyen: maChuyen,
        ma_chi_nhanh: branchId,
        include_unassigned_branch: includeUnassignedBranch,
        trang_thai_don: status,
        start_utc: startUtc,
        end_utc: endUtc,
        pagination,
      },
      pagination,
    };
  }

  private parseOptionalText(value: unknown, label: string, maxLength: number): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const text = String(value).trim();
    if (!text) {
      return null;
    }

    if (text.length > maxLength) {
      throw validationError(`${label} tối đa ${maxLength} ký tự`);
    }

    return text;
  }

  private parseOptionalPositiveInt(value: unknown, message: string): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw validationError(message);
    }

    return parsed;
  }

  private parseDateFilter(value: unknown, label: string): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const text = String(value).trim();
    if (!DATE_PATTERN.test(text)) {
      throw validationError(`${label} phải có định dạng YYYY-MM-DD`);
    }

    return text;
  }

  private ensureOrderAccess(order: BookingRecord, actor: BookingActor): void {
    if (actor.ten_vai_tro === ROLES.KHACH_HANG) {
      if (order.ma_khach_hang !== actor.ma_nguoi_dung) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.FORBIDDEN,
          'Bạn không có quyền truy cập đơn đặt vé này',
        );
      }

      return;
    }

    if (!isStaffRole(actor.ten_vai_tro)) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        'Bạn không có quyền truy cập đơn đặt vé này',
      );
    }

    if (VISIT_ALL_ROLES.includes(actor.ten_vai_tro)) {
      return;
    }

    if (
      actor.ma_chi_nhanh === null ||
      (order.ma_chi_nhanh_ban !== null && order.ma_chi_nhanh_ban !== actor.ma_chi_nhanh)
    ) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        'Bạn không có quyền truy cập đơn đặt vé của chi nhánh khác',
      );
    }
  }

  private normalizeOwnerRef(value: string): string {
    const ownerRef = String(value ?? '').trim();
    if (!OWNER_REF_PATTERN.test(ownerRef)) {
      throw validationError(
        'owner_ref phải có từ 8 đến 50 ký tự chữ, số, gạch ngang hoặc gạch dưới',
      );
    }

    return ownerRef;
  }

  private normalizeSeats(values: string[]): string[] {
    if (!Array.isArray(values) || values.length === 0) {
      throw validationError('Danh sách ghế không được để trống');
    }

    const seats = Array.from(
      new Set(values.map((value) => String(value).trim().toUpperCase()).filter(Boolean)),
    );

    if (seats.length === 0) {
      throw validationError('Danh sách ghế không được để trống');
    }

    if (seats.length > this.maxSeatsPerOrder) {
      throw validationError(`Mỗi đơn chỉ được đặt tối đa ${this.maxSeatsPerOrder} ghế`);
    }

    if (seats.some((seat) => !SEAT_CODE_PATTERN.test(seat))) {
      throw validationError('Ký hiệu ghế không hợp lệ');
    }

    return seats;
  }

  private normalizeIdempotencyKey(value: string | null | undefined): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const key = String(value).trim();
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw validationError(
        'Idempotency-Key chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới hoặc dấu hai chấm và tối đa 100 ký tự',
      );
    }

    return key;
  }

  private parseTripId(value: number): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw validationError('Mã chuyến không hợp lệ');
    }

    return value;
  }

  private async generateOrderCode(): Promise<string> {
    try {
      return await this.dependencies.orderCodeGenerator.next(this.now());
    } catch (error) {
      logger.error({ err: error }, 'booking_order_code_generation_failed');
      throw new AppError(
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        ERROR_CODES.SEAT_LOCK_UNAVAILABLE,
        'Tính năng đặt vé tạm thời không khả dụng, vui lòng thử lại sau',
      );
    }
  }

  private mapBookingError(error: unknown): unknown {
    if (getMySqlErrorCode(error) !== 'ER_DUP_ENTRY') {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('uk_chuyen_ghe') || message.includes('chi_tiet_ve')) {
      return new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.BOOKING_SEAT_CONFLICT,
        'Một số ghế vừa được bán cho đơn khác, vui lòng chọn ghế khác',
      );
    }

    if (message.includes('ma_dinh_danh_don')) {
      return new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.BOOKING_IDEMPOTENCY_CONFLICT,
        'Mã đơn đặt vé bị trùng, vui lòng thử lại',
      );
    }

    return error;
  }

  private expiryFor(status: string, createdAt: string): string | null {
    return status === DON_DAT_VE_STATUS.CHO_THANH_TOAN
      ? plusMinutesIso(createdAt, this.paymentTimeoutMinutes)
      : null;
  }

  private withExpiry(order: BookingRecord): BookingResult {
    return {
      ...order,
      thoi_gian_het_han: this.expiryFor(order.trang_thai_don, order.thoi_gian_tao),
    };
  }

  private publishReleased(
    order: { ma_chuyen: number | null; danh_sach_ghe: string[] },
    reason: 'BOOKING_EXPIRED' | 'CANCELLED',
  ): void {
    if (order.ma_chuyen === null) {
      return;
    }

    publishSeatReleased({
      ma_chuyen: order.ma_chuyen,
      danh_sach_ghe: order.danh_sach_ghe,
      reason,
    });
  }
}
