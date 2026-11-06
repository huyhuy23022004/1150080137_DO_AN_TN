import type { RequestHandler } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { HTTP_STATUS } from '../../common/http-status';
import { sendSuccess } from '../../common/response';
import type { TripService } from './trips.service';

export interface TripController {
  search: RequestHandler;
  getPublicById: RequestHandler;
  getSeatMap: RequestHandler;
  list: RequestHandler;
  listAssigned: RequestHandler;
  getManagedById: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  changeStatus: RequestHandler;
  delete: RequestHandler;
}

function parseId(value: unknown): number {
  return Number(value);
}

export function createTripController(service: TripService): TripController {
  return {
    search: asyncHandler(async (req, res) => {
      const result = await service.search({
        tinh_di: typeof req.query.tinh_di === 'string' ? req.query.tinh_di : undefined,
        tinh_den: typeof req.query.tinh_den === 'string' ? req.query.tinh_den : undefined,
        ma_tuyen: req.query.ma_tuyen,
        ngay: typeof req.query.ngay === 'string' ? req.query.ngay : undefined,
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, result.items, HTTP_STATUS.OK, result.meta);
    }),

    getPublicById: asyncHandler(async (req, res) => {
      const trip = await service.getPublicById(parseId(req.params.id));
      sendSuccess(res, { chuyen_xe: trip });
    }),

    getSeatMap: asyncHandler(async (req, res) => {
      const seatMap = await service.getSeatMap(parseId(req.params.id));
      sendSuccess(res, { so_do_ghe: seatMap });
    }),

    list: asyncHandler(async (req, res) => {
      const result = await service.list(
        {
          tinh_di: typeof req.query.tinh_di === 'string' ? req.query.tinh_di : undefined,
          tinh_den: typeof req.query.tinh_den === 'string' ? req.query.tinh_den : undefined,
          ma_tuyen: req.query.ma_tuyen,
          ma_xe: req.query.ma_xe,
          ma_tai_xe: typeof req.query.ma_tai_xe === 'string' ? req.query.ma_tai_xe : undefined,
          trang_thai: typeof req.query.trang_thai === 'string' ? req.query.trang_thai : undefined,
          tu_ngay: typeof req.query.tu_ngay === 'string' ? req.query.tu_ngay : undefined,
          den_ngay: typeof req.query.den_ngay === 'string' ? req.query.den_ngay : undefined,
          page: req.query.page,
          limit: req.query.limit,
        },
        req.scope,
      );

      sendSuccess(res, result.items, HTTP_STATUS.OK, result.meta);
    }),

    listAssigned: asyncHandler(async (req, res) => {
      const user = req.user;
      if (!user) {
        throw new Error('Driver trip controller requires an authenticated request');
      }

      const result = await service.listAssignedToDriver(user.ma_nguoi_dung, {
        trang_thai: typeof req.query.trang_thai === 'string' ? req.query.trang_thai : undefined,
        tu_ngay: typeof req.query.tu_ngay === 'string' ? req.query.tu_ngay : undefined,
        den_ngay: typeof req.query.den_ngay === 'string' ? req.query.den_ngay : undefined,
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, result.items, HTTP_STATUS.OK, result.meta);
    }),

    getManagedById: asyncHandler(async (req, res) => {
      const trip = await service.getManagedById(parseId(req.params.id), req.scope);
      sendSuccess(res, { chuyen_xe: trip });
    }),

    create: asyncHandler(async (req, res) => {
      const body = req.body as {
        ma_tuyen: number;
        ma_xe: number;
        ma_tai_xe: string;
        thoi_gian_xuat_ben: string;
        thoi_gian_den_du_kien: string;
        gia_ve_co_ban: string | number;
        trang_thai?: string;
      };

      const trip = await service.create(body, req.scope);
      sendSuccess(res, { chuyen_xe: trip }, HTTP_STATUS.CREATED);
    }),

    update: asyncHandler(async (req, res) => {
      const body = req.body as {
        ma_tuyen: number;
        ma_xe: number;
        ma_tai_xe: string;
        thoi_gian_xuat_ben: string;
        thoi_gian_den_du_kien: string;
        gia_ve_co_ban: string | number;
      };

      const trip = await service.update(parseId(req.params.id), body, req.scope);
      sendSuccess(res, { chuyen_xe: trip });
    }),

    changeStatus: asyncHandler(async (req, res) => {
      const body = req.body as { trang_thai: string };
      const trip = await service.changeStatus(parseId(req.params.id), body.trang_thai, req.scope);
      sendSuccess(res, { chuyen_xe: trip });
    }),

    delete: asyncHandler(async (req, res) => {
      await service.delete(parseId(req.params.id), req.scope);
      sendSuccess(res, { message: 'Đã xóa chuyến xe' });
    }),
  };
}
