import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { HTTP_STATUS } from '../../common/http-status';
import { sendSuccess } from '../../common/response';
import type { UserService } from './users.service';
import type { CreateUserRequest, UpdateUserRequest } from './users.service';

export interface UserController {
  list: RequestHandler;
  listRoles: RequestHandler;
  getById: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  changeStatus: RequestHandler;
  resetPassword: RequestHandler;
  delete: RequestHandler;
}

function currentUserId(req: Request): string | undefined {
  return req.user?.ma_nguoi_dung;
}

export function createUserController(service: UserService): UserController {
  return {
    list: asyncHandler(async (req, res) => {
      const result = await service.list(
        {
          q: typeof req.query.q === 'string' ? req.query.q : undefined,
          ma_vai_tro: req.query.ma_vai_tro,
          ma_chi_nhanh: req.query.ma_chi_nhanh,
          trang_thai_tai_khoan:
            typeof req.query.trang_thai_tai_khoan === 'string'
              ? req.query.trang_thai_tai_khoan
              : undefined,
          page: req.query.page,
          limit: req.query.limit,
        },
        req.scope,
      );

      sendSuccess(res, result.items, HTTP_STATUS.OK, result.meta);
    }),

    listRoles: asyncHandler(async (_req, res) => {
      const roles = await service.listRoles();
      sendSuccess(res, roles);
    }),

    getById: asyncHandler(async (req, res) => {
      const user = await service.getById(String(req.params.id), req.scope);
      sendSuccess(res, { nguoi_dung: user });
    }),

    create: asyncHandler(async (req, res) => {
      const user = await service.create(req.body as CreateUserRequest, req.scope);
      sendSuccess(res, { nguoi_dung: user }, HTTP_STATUS.CREATED);
    }),

    update: asyncHandler(async (req, res) => {
      const user = await service.update(
        String(req.params.id),
        req.body as UpdateUserRequest,
        req.scope,
        currentUserId(req),
      );
      sendSuccess(res, { nguoi_dung: user });
    }),

    changeStatus: asyncHandler(async (req, res) => {
      const body = req.body as { trang_thai_tai_khoan: string };
      const user = await service.changeStatus(
        String(req.params.id),
        body.trang_thai_tai_khoan,
        req.scope,
        currentUserId(req),
      );
      sendSuccess(res, { nguoi_dung: user });
    }),

    resetPassword: asyncHandler(async (req, res) => {
      const body = req.body as { mat_khau_moi: string };
      await service.resetPassword(String(req.params.id), body.mat_khau_moi, req.scope);
      sendSuccess(res, { message: 'Đã đặt lại mật khẩu người dùng' });
    }),

    delete: asyncHandler(async (req, res) => {
      await service.delete(String(req.params.id), req.scope, currentUserId(req));
      sendSuccess(res, { message: 'Đã xóa người dùng' });
    }),
  };
}
