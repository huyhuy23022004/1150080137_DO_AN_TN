import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { HTTP_STATUS } from '../../common/http-status';
import { sendSuccess } from '../../common/response';
import type { TicketActor } from './tickets.types';
import type { TicketService } from './tickets.service';

export interface TicketController {
  listMine: RequestHandler;
  getById: RequestHandler;
  getQr: RequestHandler;
  checkIn: RequestHandler;
  listPassengers: RequestHandler;
}

function toActor(req: Request): TicketActor {
  const user = req.user;

  if (!user) {
    throw new Error('Ticket controller requires an authenticated request');
  }

  return {
    ma_nguoi_dung: user.ma_nguoi_dung,
    ho_va_ten: user.ho_va_ten,
    ten_vai_tro: user.ten_vai_tro,
    ma_chi_nhanh: user.ma_chi_nhanh,
  };
}

export function createTicketController(service: TicketService): TicketController {
  return {
    listMine: asyncHandler(async (req, res) => {
      const result = await service.listMine(toActor(req), {
        trang_thai_soat_ve: req.query.trang_thai_soat_ve,
        trang_thai_don: req.query.trang_thai_don,
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, result.items, HTTP_STATUS.OK, result.meta);
    }),

    getById: asyncHandler(async (req, res) => {
      const ticket = await service.getById(String(req.params.id), toActor(req));
      sendSuccess(res, { ve: ticket });
    }),

    getQr: asyncHandler(async (req, res) => {
      if (req.query.format === 'png') {
        const result = await service.getQrPng(String(req.params.id), toActor(req));
        res.type('image/png');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="ticket-${result.ticket.ma_ve}.png"`,
        );
        res.send(result.buffer);
        return;
      }

      const result = await service.getQr(String(req.params.id), toActor(req));
      sendSuccess(res, {
        ma_ve: result.ve.ma_ve,
        ma_qr_kiem_tra: result.qr_token,
        dinh_dang: 'png',
        qr_data_url: result.qr_data_url,
      });
    }),

    checkIn: asyncHandler(async (req, res) => {
      const body = req.body as { ma_qr?: unknown; token?: unknown };
      const result = await service.checkIn({ ma_qr: body.ma_qr ?? body.token }, toActor(req));

      sendSuccess(res, {
        already_checked_in: result.already_checked_in,
        ve: result.ve,
      });
    }),

    listPassengers: asyncHandler(async (req, res) => {
      const result = await service.listPassengers(req.params.tripId, toActor(req));
      sendSuccess(res, { chuyen_xe: result });
    }),
  };
}
