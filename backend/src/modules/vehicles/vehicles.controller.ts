import type { RequestHandler } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { HTTP_STATUS } from '../../common/http-status';
import { sendSuccess } from '../../common/response';
import type { VehicleService } from './vehicles.service';

export interface VehicleController {
  list: RequestHandler;
  getById: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  delete: RequestHandler;
}

function parseId(value: unknown): number {
  return Number(value);
}

export function createVehicleController(service: VehicleService): VehicleController {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await service.list({
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        ma_loai_xe: req.query.ma_loai_xe,
        trang_thai: typeof req.query.trang_thai === 'string' ? req.query.trang_thai : undefined,
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, result.items, HTTP_STATUS.OK, result.meta);
    }),

    getById: asyncHandler(async (req, res) => {
      const vehicle = await service.getById(parseId(req.params.id));
      sendSuccess(res, { xe: vehicle });
    }),

    create: asyncHandler(async (req, res) => {
      const body = req.body as {
        ma_loai_xe: number;
        bien_so_xe: string;
        hang_san_xuat?: string | null;
        trang_thai?: string;
      };

      const vehicle = await service.create(body);
      sendSuccess(res, { xe: vehicle }, HTTP_STATUS.CREATED);
    }),

    update: asyncHandler(async (req, res) => {
      const body = req.body as {
        ma_loai_xe: number;
        bien_so_xe: string;
        hang_san_xuat?: string | null;
        trang_thai?: string;
      };

      const vehicle = await service.update(parseId(req.params.id), body);
      sendSuccess(res, { xe: vehicle });
    }),

    delete: asyncHandler(async (req, res) => {
      await service.delete(parseId(req.params.id));
      sendSuccess(res, { message: 'Đã xóa xe' });
    }),
  };
}
