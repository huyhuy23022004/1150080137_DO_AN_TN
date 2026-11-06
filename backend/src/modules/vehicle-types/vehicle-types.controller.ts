import type { RequestHandler } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { sendSuccess } from '../../common/response';
import { HTTP_STATUS } from '../../common/http-status';
import type { SeatInput } from './vehicle-types.types';
import type { VehicleTypeService } from './vehicle-types.service';

export interface VehicleTypeController {
  list: RequestHandler;
  getById: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  delete: RequestHandler;
}

function parseId(value: unknown): number {
  return Number(value);
}

export function createVehicleTypeController(service: VehicleTypeService): VehicleTypeController {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await service.list({
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, result.items, HTTP_STATUS.OK, result.meta);
    }),

    getById: asyncHandler(async (req, res) => {
      const record = await service.getById(parseId(req.params.id));
      sendSuccess(res, { loai_xe: record });
    }),

    create: asyncHandler(async (req, res) => {
      const body = req.body as {
        ten_loai_xe: string;
        so_tang: number;
        so_do_ghe: SeatInput[];
      };
      const record = await service.create(body);
      sendSuccess(res, { loai_xe: record }, HTTP_STATUS.CREATED);
    }),

    update: asyncHandler(async (req, res) => {
      const body = req.body as {
        ten_loai_xe: string;
        so_tang: number;
        so_do_ghe?: SeatInput[];
      };
      const record = await service.update(parseId(req.params.id), body);
      sendSuccess(res, { loai_xe: record });
    }),

    delete: asyncHandler(async (req, res) => {
      await service.delete(parseId(req.params.id));
      sendSuccess(res, { message: 'Đã xóa loại xe' });
    }),
  };
}
