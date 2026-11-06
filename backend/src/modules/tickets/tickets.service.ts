import { config } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  CHI_TIET_VE_STATUS,
  DON_DAT_VE_STATUS,
  ROLES,
  TRANG_THAI_SOAT_VE,
  type RoleName,
} from '../../common/constants';
import { HTTP_STATUS } from '../../common/http-status';
import { withTransaction } from '../../db/transaction';
import { buildPaginationMeta, resolvePagination } from '../../utils/pagination';
import { renderQrDataUrl, renderQrPng } from '../../utils/qr-image';
import { verifyTicketQrToken } from '../../utils/qr-token';
import type {
  CheckinResult,
  TicketActor,
  TicketRecord,
  TicketRepositoryPort,
  TripPassengersResult,
} from './tickets.types';

const PASSENGER_VIEW_ROLES: readonly RoleName[] = [
  ROLES.QUAN_TRI_VIEN,
  ROLES.DIEU_HANH,
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.TAI_XE,
];

const BRANCH_BOUND_ROLES: readonly RoleName[] = [ROLES.QUAN_LY_CHI_NHANH, ROLES.NHAN_VIEN_PHONG_VE];

export interface TicketServiceDependencies {
  repository: TicketRepositoryPort;
  now?: () => Date;
  checkinOpenHoursBefore?: number;
  checkinCloseHoursAfter?: number;
}

export interface TicketListQuery {
  trang_thai_soat_ve?: unknown;
  trang_thai_don?: unknown;
  page?: unknown;
  limit?: unknown;
}

export interface TicketQrResult {
  ve: TicketRecord;
  qr_token: string;
  qr_data_url: string;
}

function notFoundError(): AppError {
  return new AppError(HTTP_STATUS.NOT_FOUND, ERROR_CODES.TICKET_NOT_FOUND, 'Không tìm thấy vé');
}

function invalidQrError(): AppError {
  return new AppError(
    HTTP_STATUS.UNPROCESSABLE_ENTITY,
    ERROR_CODES.TICKET_INVALID_QR,
    'Mã QR vé không hợp lệ hoặc đã bị giả mạo',
  );
}

function forbiddenError(message = 'Bạn không có quyền truy cập vé này'): AppError {
  return new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, message);
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export class TicketService {
  private readonly repository: TicketRepositoryPort;
  private readonly now: () => Date;
  private readonly checkinOpenHoursBefore: number;
  private readonly checkinCloseHoursAfter: number;

  public constructor(dependencies: TicketServiceDependencies) {
    this.repository = dependencies.repository;
    this.now = dependencies.now ?? (() => new Date());
    this.checkinOpenHoursBefore =
      dependencies.checkinOpenHoursBefore ?? config.qr.checkinOpenHoursBefore;
    this.checkinCloseHoursAfter =
      dependencies.checkinCloseHoursAfter ?? config.qr.checkinCloseHoursAfter;
  }

  public async listMine(
    actor: TicketActor,
    query: TicketListQuery = {},
  ): Promise<{
    items: TicketRecord[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const pagination = resolvePagination(query.page, query.limit);
    const result = await this.repository.listByCustomer(actor.ma_nguoi_dung, {
      trang_thai_soat_ve: this.normalizeTicketStatus(query.trang_thai_soat_ve),
      trang_thai_don: this.normalizeOrderStatus(query.trang_thai_don),
      pagination,
    });

    return {
      items: result.items,
      meta: buildPaginationMeta(result.total, pagination),
    };
  }

  public async getById(ticketId: string, actor: TicketActor): Promise<TicketRecord> {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) {
      throw notFoundError();
    }

    this.ensureTicketAccess(ticket, actor);
    return ticket;
  }

  public async getQr(ticketId: string, actor: TicketActor): Promise<TicketQrResult> {
    const ticket = await this.getById(ticketId, actor);
    const qrDataUrl = await renderQrDataUrl(ticket.ma_qr_kiem_tra);

    return {
      ve: ticket,
      qr_token: ticket.ma_qr_kiem_tra,
      qr_data_url: qrDataUrl,
    };
  }

  public async getQrPng(
    ticketId: string,
    actor: TicketActor,
  ): Promise<{ ticket: TicketRecord; buffer: Buffer }> {
    const ticket = await this.getById(ticketId, actor);
    const buffer = await renderQrPng(ticket.ma_qr_kiem_tra);
    return { ticket, buffer };
  }

  public async checkIn(input: { ma_qr: unknown }, actor: TicketActor): Promise<CheckinResult> {
    if (actor.ten_vai_tro !== ROLES.TAI_XE) {
      throw forbiddenError('Chỉ tài xế được phép soát vé');
    }

    const token = typeof input.ma_qr === 'string' ? input.ma_qr.trim() : '';
    if (!token || token.length > 1_000) {
      throw invalidQrError();
    }

    const payload = verifyTicketQrToken(token);
    if (!payload) {
      throw invalidQrError();
    }

    return withTransaction(async (connection) => {
      const ticket = await this.repository.findByToken(token, connection, true);
      if (!ticket) {
        throw notFoundError();
      }

      if (ticket.ma_chuyen !== payload.ma_chuyen || ticket.ky_hieu_ghe !== payload.ky_hieu_ghe) {
        throw invalidQrError();
      }

      if (ticket.ma_tai_xe !== actor.ma_nguoi_dung) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.TICKET_WRONG_TRIP,
          'Vé không thuộc chuyến xe mà bạn đang phụ trách',
        );
      }

      if (
        ticket.trang_thai_don === DON_DAT_VE_STATUS.DA_HUY ||
        ticket.trang_thai_ve !== CHI_TIET_VE_STATUS.HIEU_LUC ||
        ticket.trang_thai_chuyen === 'HUY'
      ) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.TICKET_CANCELLED,
          'Vé hoặc chuyến xe đã bị hủy',
        );
      }

      if (ticket.trang_thai_don !== DON_DAT_VE_STATUS.DA_THANH_TOAN) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.TICKET_NOT_PAID,
          'Đơn đặt vé chưa được thanh toán',
        );
      }

      if (ticket.trang_thai_soat_ve === TRANG_THAI_SOAT_VE.DA_LEN_XE) {
        return { already_checked_in: true, ve: ticket };
      }

      this.ensureCheckinWindow(ticket);

      const updated = await this.repository.updateCheckin(
        ticket.ma_ve,
        actor.ma_nguoi_dung,
        connection,
      );

      if (!updated) {
        return { already_checked_in: true, ve: ticket };
      }

      return {
        already_checked_in: false,
        ve: {
          ...ticket,
          trang_thai_soat_ve: TRANG_THAI_SOAT_VE.DA_LEN_XE,
          thoi_gian_soat_ve: this.now().toISOString(),
          tai_xe_soat_ve: actor.ma_nguoi_dung,
        },
      };
    });
  }

  public async listPassengers(
    tripIdValue: unknown,
    actor: TicketActor,
  ): Promise<TripPassengersResult> {
    if (!PASSENGER_VIEW_ROLES.includes(actor.ten_vai_tro)) {
      throw forbiddenError('Bạn không có quyền xem danh sách hành khách');
    }

    const tripId = parsePositiveInt(tripIdValue);
    if (tripId === null) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Mã chuyến không hợp lệ',
      );
    }

    const trip = await this.repository.findTripAssignment(tripId);
    if (!trip) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.TRIP_NOT_FOUND,
        'Không tìm thấy chuyến xe',
      );
    }

    if (actor.ten_vai_tro === ROLES.TAI_XE && trip.ma_tai_xe !== actor.ma_nguoi_dung) {
      throw forbiddenError('Bạn không phụ trách chuyến xe này');
    }

    if (
      BRANCH_BOUND_ROLES.includes(actor.ten_vai_tro) &&
      (actor.ma_chi_nhanh === null ||
        (trip.ma_chi_nhanh_tai_xe !== null && trip.ma_chi_nhanh_tai_xe !== actor.ma_chi_nhanh))
    ) {
      throw forbiddenError('Bạn không có quyền xem chuyến xe của chi nhánh khác');
    }

    const passengers = await this.repository.listPassengersByTrip(tripId);
    const daLenXe = passengers.filter(
      (passenger) => passenger.trang_thai_soat_ve === TRANG_THAI_SOAT_VE.DA_LEN_XE,
    ).length;

    return {
      ma_chuyen: trip.ma_chuyen,
      thoi_gian_xuat_ben: trip.thoi_gian_xuat_ben,
      tong_so_hanh_khach: passengers.length,
      da_len_xe: daLenXe,
      chua_len_xe: passengers.length - daLenXe,
      danh_sach: passengers,
    };
  }

  private ensureTicketAccess(ticket: TicketRecord, actor: TicketActor): void {
    if (actor.ten_vai_tro === ROLES.KHACH_HANG) {
      if (ticket.ma_khach_hang !== actor.ma_nguoi_dung) {
        throw forbiddenError();
      }

      return;
    }

    if (actor.ten_vai_tro === ROLES.TAI_XE) {
      if (ticket.ma_tai_xe !== actor.ma_nguoi_dung) {
        throw forbiddenError();
      }

      return;
    }

    if (actor.ten_vai_tro === ROLES.QUAN_TRI_VIEN || actor.ten_vai_tro === ROLES.DIEU_HANH) {
      return;
    }

    if (
      actor.ma_chi_nhanh === null ||
      ticket.ma_chi_nhanh_ban === null ||
      ticket.ma_chi_nhanh_ban !== actor.ma_chi_nhanh
    ) {
      throw forbiddenError();
    }
  }

  private ensureCheckinWindow(ticket: TicketRecord): void {
    const departure = new Date(ticket.thoi_gian_xuat_ben).getTime();
    if (Number.isNaN(departure)) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TICKET_CHECKIN_NOT_OPEN,
        'Không xác định được thời gian khởi hành của chuyến xe',
      );
    }

    const now = this.now().getTime();
    const openAt = departure - this.checkinOpenHoursBefore * 60 * 60_000;
    const closeAt = departure + this.checkinCloseHoursAfter * 60 * 60_000;

    if (now < openAt || now > closeAt) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TICKET_CHECKIN_NOT_OPEN,
        'Chưa đến hoặc đã quá thời gian soát vé cho chuyến xe này',
      );
    }
  }

  private normalizeTicketStatus(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    return (Object.values(TRANG_THAI_SOAT_VE) as string[]).includes(value) ? value : null;
  }

  private normalizeOrderStatus(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    return (Object.values(DON_DAT_VE_STATUS) as string[]).includes(value) ? value : null;
  }
}
