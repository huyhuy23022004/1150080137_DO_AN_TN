import Decimal from 'decimal.js';
import { logger } from '../../config/logger';
import { config } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { getMySqlErrorCode } from '../../common/errors/db-errors';
import {
  DON_DAT_VE_STATUS,
  ROLES,
  TRANG_THAI_THANH_TOAN,
  type RoleName,
} from '../../common/constants';
import { HTTP_STATUS } from '../../common/http-status';
import { withTransaction } from '../../db/transaction';
import { publishSeatBooked } from '../../realtime/events';
import {
  buildVnpayPaymentUrl,
  extractVnpayParams,
  verifyVnpaySignature,
  type VnpaySettings,
} from '../../utils/vnpay';
import type {
  PaymentActor,
  PaymentOrderRecord,
  PaymentRepositoryPort,
  VnpayCreateUrlResult,
  VnpayProcessResult,
} from './payments.types';

const READ_ALL_ROLES: readonly RoleName[] = [ROLES.QUAN_TRI_VIEN, ROLES.DIEU_HANH];

export interface PaymentServiceDependencies {
  repository: PaymentRepositoryPort;
  settings?: VnpaySettings;
  now?: () => Date;
}

function defaultSettings(): VnpaySettings {
  return {
    tmnCode: config.vnpay.tmnCode ?? '',
    hashSecret: config.vnpay.hashSecret ?? '',
    url: config.vnpay.url,
    returnUrl: config.vnpay.returnUrl,
    version: config.vnpay.version,
    command: config.vnpay.command,
    currCode: config.vnpay.currCode,
    locale: config.vnpay.locale,
    orderType: config.vnpay.orderType,
    expireMinutes: config.vnpay.paymentExpireMinutes,
  };
}

function isSuccessfulVnpayResponse(params: Record<string, string>): boolean {
  if (params.vnp_ResponseCode !== '00') {
    return false;
  }

  const transactionStatus = params.vnp_TransactionStatus;
  return transactionStatus === undefined || transactionStatus === '' || transactionStatus === '00';
}

function result(
  rspCode: VnpayProcessResult['rsp_code'],
  message: string,
  overrides: Partial<VnpayProcessResult> = {},
): VnpayProcessResult {
  return {
    rsp_code: rspCode,
    message,
    ma_don_ve: null,
    ma_dinh_danh_don: null,
    trang_thai_don: null,
    ma_giao_dich_vnpay: null,
    thanh_cong: false,
    already_confirmed: false,
    ...overrides,
  };
}

export class PaymentService {
  private readonly repository: PaymentRepositoryPort;
  private readonly settings: VnpaySettings;
  private readonly now: () => Date;

  public constructor(dependencies: PaymentServiceDependencies) {
    this.repository = dependencies.repository;
    this.settings = dependencies.settings ?? defaultSettings();
    this.now = dependencies.now ?? (() => new Date());
  }

  public async createVnpayUrl(
    orderId: string,
    actor: PaymentActor,
    ipAddr: string,
  ): Promise<VnpayCreateUrlResult> {
    if (!this.settings.tmnCode || !this.settings.hashSecret) {
      throw new AppError(
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Cổng thanh toán VNPAY chưa được cấu hình',
      );
    }

    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.BOOKING_NOT_FOUND,
        'Không tìm thấy đơn đặt vé',
      );
    }

    this.ensureOrderAccess(order, actor);

    if (order.trang_thai_don === DON_DAT_VE_STATUS.DA_THANH_TOAN) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.PAYMENT_INVALID_STATE,
        'Đơn đặt vé đã được thanh toán',
      );
    }

    if (order.trang_thai_don !== DON_DAT_VE_STATUS.CHO_THANH_TOAN) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.PAYMENT_INVALID_STATE,
        'Đơn đặt vé không ở trạng thái chờ thanh toán',
      );
    }

    const payment = await this.repository.findVnpayPayment(order.ma_don_ve);
    if (!payment) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.PAYMENT_NOT_FOUND,
        'Đơn đặt vé không có giao dịch VNPAY',
      );
    }

    if (payment.trang_thai === TRANG_THAI_THANH_TOAN.THANH_CONG) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.PAYMENT_INVALID_STATE,
        'Giao dịch VNPAY đã thanh toán thành công',
      );
    }

    const now = this.now();
    const paymentUrl = buildVnpayPaymentUrl(this.settings, {
      txnRef: order.ma_dinh_danh_don,
      amount: order.tong_tien,
      orderInfo: `Thanh toan ve FUTA ${order.ma_dinh_danh_don}`,
      ipAddr,
      createdAt: now,
    });

    return {
      ma_don_ve: order.ma_don_ve,
      ma_dinh_danh_don: order.ma_dinh_danh_don,
      so_tien: order.tong_tien,
      payment_url: paymentUrl,
      het_han_thanh_toan: new Date(
        now.getTime() + this.settings.expireMinutes * 60_000,
      ).toISOString(),
    };
  }

  public async processVnpayCallback(
    rawQuery: Record<string, unknown>,
  ): Promise<VnpayProcessResult> {
    const params = extractVnpayParams(rawQuery);

    if (!this.settings.hashSecret) {
      logger.error('vnpay_hash_secret_missing');
      return result('99', 'Cổng thanh toán chưa được cấu hình');
    }

    if (!verifyVnpaySignature(params, this.settings.hashSecret)) {
      logger.warn({ txnRef: params.vnp_TxnRef ?? null }, 'vnpay_invalid_signature');
      return result('97', 'Chữ ký không hợp lệ');
    }

    const txnRef = params.vnp_TxnRef;
    if (!txnRef) {
      return result('01', 'Không tìm thấy đơn hàng');
    }

    try {
      const processed = await withTransaction(async (connection) => {
        const order = await this.repository.lockOrderByIdentifier(txnRef, connection);
        if (!order) {
          return result('01', 'Không tìm thấy đơn hàng');
        }

        const payment = await this.repository.findVnpayPayment(order.ma_don_ve, connection);
        if (!payment) {
          return result('01', 'Không tìm thấy giao dịch thanh toán', {
            ma_don_ve: order.ma_don_ve,
            ma_dinh_danh_don: order.ma_dinh_danh_don,
          });
        }

        const expectedAmount = new Decimal(order.tong_tien).mul(100).toFixed(0);
        if (params.vnp_Amount !== expectedAmount) {
          logger.warn(
            { orderId: order.ma_don_ve, expectedAmount, received: params.vnp_Amount },
            'vnpay_amount_mismatch',
          );
          return result('04', 'Số tiền thanh toán không khớp', {
            ma_don_ve: order.ma_don_ve,
            ma_dinh_danh_don: order.ma_dinh_danh_don,
          });
        }

        if (order.trang_thai_don === DON_DAT_VE_STATUS.DA_THANH_TOAN) {
          return result('02', 'Đơn hàng đã được xác nhận thanh toán', {
            ma_don_ve: order.ma_don_ve,
            ma_dinh_danh_don: order.ma_dinh_danh_don,
            trang_thai_don: order.trang_thai_don,
            ma_giao_dich_vnpay: payment.ma_giao_dich_vnpay,
            thanh_cong: true,
            already_confirmed: true,
          });
        }

        if (order.trang_thai_don === DON_DAT_VE_STATUS.DA_HUY) {
          logger.warn(
            {
              orderId: order.ma_don_ve,
              transactionNo: params.vnp_TransactionNo ?? null,
            },
            'vnpay_paid_after_cancel',
          );
          return result('00', 'Đơn hàng đã hủy, ghi nhận để hoàn tiền thủ công', {
            ma_don_ve: order.ma_don_ve,
            ma_dinh_danh_don: order.ma_dinh_danh_don,
            trang_thai_don: order.trang_thai_don,
            ma_giao_dich_vnpay: params.vnp_TransactionNo ?? null,
          });
        }

        const responsePayload = JSON.stringify(params);

        if (!isSuccessfulVnpayResponse(params)) {
          await this.repository.markPaymentFailed(
            {
              ma_thanh_toan: payment.ma_thanh_toan,
              thong_tin_phan_hoi: responsePayload,
            },
            connection,
          );

          return result('00', 'Đã ghi nhận giao dịch thanh toán thất bại', {
            ma_don_ve: order.ma_don_ve,
            ma_dinh_danh_don: order.ma_dinh_danh_don,
            trang_thai_don: order.trang_thai_don,
            ma_giao_dich_vnpay: params.vnp_TransactionNo ?? null,
          });
        }

        const vnpayTransactionNo = params.vnp_TransactionNo ?? txnRef;

        await this.repository.markPaymentSuccess(
          {
            ma_thanh_toan: payment.ma_thanh_toan,
            ma_giao_dich_vnpay: vnpayTransactionNo,
            thong_tin_phan_hoi: responsePayload,
          },
          connection,
        );

        await this.repository.markOrderPaid(order.ma_don_ve, connection);

        return result('00', 'Xác nhận thanh toán thành công', {
          ma_don_ve: order.ma_don_ve,
          ma_dinh_danh_don: order.ma_dinh_danh_don,
          trang_thai_don: DON_DAT_VE_STATUS.DA_THANH_TOAN,
          ma_giao_dich_vnpay: vnpayTransactionNo,
          thanh_cong: true,
        });
      });

      if (processed.thanh_cong && !processed.already_confirmed && processed.ma_don_ve) {
        await this.publishPaidOrder(processed.ma_don_ve);
      }

      return processed;
    } catch (error) {
      if (getMySqlErrorCode(error) === 'ER_DUP_ENTRY') {
        logger.warn({ txnRef }, 'vnpay_duplicate_transaction');
        return result('02', 'Giao dịch đã được xác nhận trước đó', {
          ma_dinh_danh_don: txnRef,
          already_confirmed: true,
        });
      }

      logger.error({ err: error, txnRef }, 'vnpay_callback_failed');
      return result('99', 'Lỗi hệ thống, vui lòng thử lại');
    }
  }

  private async publishPaidOrder(orderId: string): Promise<void> {
    const seats = await this.repository.findOrderSeats(orderId);

    if (seats.ma_chuyen === null || seats.danh_sach_ghe.length === 0) {
      return;
    }

    publishSeatBooked({
      ma_chuyen: seats.ma_chuyen,
      danh_sach_ghe: seats.danh_sach_ghe,
      ma_don_ve: orderId,
      trang_thai_don: DON_DAT_VE_STATUS.DA_THANH_TOAN,
    });
  }

  private ensureOrderAccess(order: PaymentOrderRecord, actor: PaymentActor): void {
    if (actor.ten_vai_tro === ROLES.KHACH_HANG) {
      if (order.ma_khach_hang !== actor.ma_nguoi_dung) {
        throw forbiddenError();
      }

      return;
    }

    if (READ_ALL_ROLES.includes(actor.ten_vai_tro)) {
      return;
    }

    if (
      actor.ma_chi_nhanh === null ||
      (order.ma_chi_nhanh_ban !== null && order.ma_chi_nhanh_ban !== actor.ma_chi_nhanh)
    ) {
      throw forbiddenError();
    }
  }
}

function forbiddenError(): AppError {
  return new AppError(
    HTTP_STATUS.FORBIDDEN,
    ERROR_CODES.FORBIDDEN,
    'Bạn không có quyền truy cập đơn đặt vé này',
  );
}
