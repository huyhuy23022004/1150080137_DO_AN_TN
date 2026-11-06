import type { RequestHandler } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { HTTP_STATUS } from '../../common/http-status';
import { sendSuccess } from '../../common/response';
import type { BranchService } from './branches.service';
import type { CreateBranchInput, UpdateBranchInput } from './branches.types';

export interface BranchController {
  list: RequestHandler;
  getById: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  delete: RequestHandler;
}

function parseId(value: unknown): number {
  return Number(value);
}

export function createBranchController(service: BranchService): BranchController {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await service.list({
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        tinh_thanh: typeof req.query.tinh_thanh === 'string' ? req.query.tinh_thanh : undefined,
        trang_thai_hoat_dong:
          typeof req.query.trang_thai_hoat_dong === 'string'
            ? req.query.trang_thai_hoat_dong
            : undefined,
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, result.items, HTTP_STATUS.OK, result.meta);
    }),

    getById: asyncHandler(async (req, res) => {
      const branch = await service.getById(parseId(req.params.id));
      sendSuccess(res, { chi_nhanh: branch });
    }),

    create: asyncHandler(async (req, res) => {
      const branch = await service.create(req.body as CreateBranchInput);
      sendSuccess(res, { chi_nhanh: branch }, HTTP_STATUS.CREATED);
    }),

    update: asyncHandler(async (req, res) => {
      const branch = await service.update(parseId(req.params.id), req.body as UpdateBranchInput);
      sendSuccess(res, { chi_nhanh: branch });
    }),

    delete: asyncHandler(async (req, res) => {
      await service.delete(parseId(req.params.id));
      sendSuccess(res, { message: 'Đã xóa chi nhánh' });
    }),
  };
}
