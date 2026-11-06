import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { HTTP_STATUS } from '../../common/http-status';
import { sendSuccess } from '../../common/response';
import { logger } from '../../config/logger';
import type { PaymentActor, VnpayProcessResult } from './payments.types';
import type { PaymentService } from './payments.service';

export interface PaymentController {
  createUrl: RequestHandler;
  vnpayReturn: RequestHandler;
  vnpayIpn: RequestHandler;
}

function toActor(req: Request): PaymentActor {
  const user = req.user;

  if (!user) {
    throw new Error('Payment controller requires an authenticated request');
  }

  return {
    ma_nguoi_dung: user.ma_nguoi_dung,
    ten_vai_tro: user.ten_vai_tro,
    ma_chi_nhanh: user.ma_chi_nhanh,
  };
}

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? '127.0.0.1';
}

function toReturnError(result: VnpayProcessResult): AppError | null {
  if (result.rsp_code === '97') {
    return new AppError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.PAYMENT_INVALID_SIGNATURE,
      'Chữ ký VNPAY không hợp lệ',
    );
  }

  if (result.rsp_code === '01') {
    return new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.BOOKING_NOT_FOUND,
      'Không tìm thấy đơn đặt vé',
    );
  }

  if (result.rsp_code === '04') {
    return new AppError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.PAYMENT_AMOUNT_MISMATCH,
      'Số tiền thanh toán không khớp',
    );
  }

  if (result.rsp_code === '99') {
    return new AppError(
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      'Không thể xử lý kết quả thanh toán, vui lòng thử lại sau',
    );
  }

  return null;
}

export function createPaymentController(service: PaymentService): PaymentController {
  return {
    createUrl: asyncHandler(async (req, res) => {
      const body = req.body as { ma_don_ve: string | number };
      const payment = await service.createVnpayUrl(
        String(body.ma_don_ve),
        toActor(req),
        clientIp(req),
      );

      sendSuccess(res, { thanh_toan: payment }, HTTP_STATUS.CREATED);
    }),

    vnpayReturn: asyncHandler(async (req, res) => {
      const result = await service.processVnpayCallback(req.query as Record<string, unknown>);

      const error = toReturnError(result);
      if (error) {
        throw error;
      }

      sendSuccess(res, { ket_qua_thanh_toan: result });
    }),

    vnpayIpn: async (req, res) => {
      try {
        const result = await service.processVnpayCallback(req.query as Record<string, unknown>);

        res.status(HTTP_STATUS.OK).json({
          RspCode: result.rsp_code,
          Message: result.message,
        });
      } catch (error) {
        logger.error({ err: error }, 'vnpay_ipn_unhandled');
        res.status(HTTP_STATUS.OK).json({
          RspCode: '99',
          Message: 'Lỗi hệ thống, vui lòng thử lại',
        });
      }
    },
  };
}
