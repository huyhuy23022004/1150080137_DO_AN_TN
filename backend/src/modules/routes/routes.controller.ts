import type { RequestHandler } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { HTTP_STATUS } from '../../common/http-status';
import { sendSuccess } from '../../common/response';
import type { RouteService } from './routes.service';
import type { RouteStopInput } from './routes.types';

export interface RouteController {
  list: RequestHandler;
  getById: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  delete: RequestHandler;
}

function parseId(value: unknown): number {
  return Number(value);
}

export function createRouteController(service: RouteService): RouteController {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await service.list({
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        tinh_di: typeof req.query.tinh_di === 'string' ? req.query.tinh_di : undefined,
        tinh_den: typeof req.query.tinh_den === 'string' ? req.query.tinh_den : undefined,
        trang_thai: typeof req.query.trang_thai === 'string' ? req.query.trang_thai : undefined,
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, result.items, HTTP_STATUS.OK, result.meta);
    }),

    getById: asyncHandler(async (req, res) => {
      const route = await service.getById(parseId(req.params.id));
      sendSuccess(res, { tuyen_duong: route });
    }),

    create: asyncHandler(async (req, res) => {
      const body = req.body as {
        ten_tuyen: string;
        tinh_di: string;
        tinh_den: string;
        khoang_cach_km: string | number;
        thoi_gian_chay_du_kien: number;
        trang_thai: boolean;
        diem_dung: RouteStopInput[];
      };

      const route = await service.create(body);
      sendSuccess(res, { tuyen_duong: route }, HTTP_STATUS.CREATED);
    }),

    update: asyncHandler(async (req, res) => {
      const body = req.body as {
        ten_tuyen: string;
        tinh_di: string;
        tinh_den: string;
        khoang_cach_km: string | number;
        thoi_gian_chay_du_kien: number;
        trang_thai: boolean;
        diem_dung?: RouteStopInput[];
      };

      const route = await service.update(parseId(req.params.id), body);
      sendSuccess(res, { tuyen_duong: route });
    }),

    delete: asyncHandler(async (req, res) => {
      await service.delete(parseId(req.params.id));
      sendSuccess(res, { message: 'Đã xóa tuyến đường' });
    }),
  };
}
