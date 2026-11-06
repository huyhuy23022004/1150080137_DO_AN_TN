import type { RequestHandler } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { HTTP_STATUS } from '../../common/http-status';
import { sendSuccess } from '../../common/response';
import type { BookingActor } from './bookings.types';
import type { BookingService } from './bookings.service';
import type { PaymentService } from '../payments/payments.service';

export interface BookingController {
  quote: RequestHandler;
  create: RequestHandler;
  list: RequestHandler;
  getById: RequestHandler;
  getByCode: RequestHandler;
  cancel: RequestHandler;
  confirmCash: RequestHandler;
}

function toActor(req: Parameters<RequestHandler>[0]): BookingActor {
  const user = req.user;

  if (!user) {
    throw new Error('Booking controller requires an authenticated request');
  }

  return {
    ma_nguoi_dung: user.ma_nguoi_dung,
    ho_va_ten: user.ho_va_ten,
    ten_vai_tro: user.ten_vai_tro,
    ma_chi_nhanh: user.ma_chi_nhanh,
  };
}

function idempotencyKey(req: Parameters<RequestHandler>[0]): string | null {
  const headerValue = req.header('Idempotency-Key');
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  const body = req.body as { idempotency_key?: unknown };
  return typeof body.idempotency_key === 'string' ? body.idempotency_key : null;
}

export function createBookingController(
  service: BookingService,
  paymentService?: PaymentService,
): BookingController {
  return {
    quote: asyncHandler(async (req, res) => {
      const body = req.body as { ma_chuyen: number; danh_sach_ghe: string[] };
      const quote = await service.quote(body.ma_chuyen, body.danh_sach_ghe);
      sendSuccess(res, { bao_gia: quote });
    }),

    create: asyncHandler(async (req, res) => {
      const body = req.body as {
        ma_chuyen: number;
        danh_sach_ghe: string[];
        owner_ref: string;
        ma_diem_don: number;
        ma_diem_tra: number;
        ho_ten_khach?: string;
        so_dien_thoai_khach?: string;
        email_khach?: string;
        phuong_thuc_thanh_toan?: 'TIEN_MAT' | 'VNPAY';
      };

      const actor = toActor(req);
      const booking = await service.create(
        {
          ma_chuyen: body.ma_chuyen,
          danh_sach_ghe: body.danh_sach_ghe,
          owner_ref: body.owner_ref,
          ma_diem_don: body.ma_diem_don,
          ma_diem_tra: body.ma_diem_tra,
          ho_ten_khach: body.ho_ten_khach,
          so_dien_thoai_khach: body.so_dien_thoai_khach,
          email_khach: body.email_khach,
          phuong_thuc_thanh_toan: body.phuong_thuc_thanh_toan,
          idempotency_key: idempotencyKey(req),
        },
        actor,
      );

      let paymentUrl: string | null = null;

      if (body.phuong_thuc_thanh_toan === 'VNPAY' && booking.trang_thai_don === 'CHO_THANH_TOAN') {
        if (!paymentService) {
          throw new Error('Payment service is required for VNPAY bookings');
        }

        const payment = await paymentService.createVnpayUrl(
          booking.ma_don_ve,
          actor,
          req.ip ?? req.socket.remoteAddress ?? '127.0.0.1',
        );
        paymentUrl = payment.payment_url;
      }

      sendSuccess(
        res,
        {
          don_dat_ve: booking,
          ...(paymentUrl === null ? {} : { payment_url: paymentUrl }),
        },
        HTTP_STATUS.CREATED,
      );
    }),

    list: asyncHandler(async (req, res) => {
      const result = await service.list(req.query, toActor(req));
      sendSuccess(res, result.items, HTTP_STATUS.OK, result.meta);
    }),

    getById: asyncHandler(async (req, res) => {
      const booking = await service.getById(String(req.params.id), toActor(req));
      sendSuccess(res, { don_dat_ve: booking });
    }),

    getByCode: asyncHandler(async (req, res) => {
      const booking = await service.getByCode(String(req.params.code), toActor(req));
      sendSuccess(res, { don_dat_ve: booking });
    }),

    cancel: asyncHandler(async (req, res) => {
      const booking = await service.cancel(String(req.params.id), toActor(req));
      sendSuccess(res, { don_dat_ve: booking });
    }),

    confirmCash: asyncHandler(async (req, res) => {
      const booking = await service.confirmCash(String(req.params.id), toActor(req));
      sendSuccess(res, { don_dat_ve: booking });
    }),
  };
}
