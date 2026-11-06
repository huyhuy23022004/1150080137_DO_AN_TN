import { Router, type RequestHandler } from 'express';
import { ROLES } from '../../common/constants';
import { attachBranchScope, requireRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createUserController } from './users.controller';
import type { UserService } from './users.service';
import {
  createUserValidators,
  listUsersValidators,
  resetUserPasswordValidators,
  updateUserStatusValidators,
  updateUserValidators,
  userIdOnlyValidators,
} from './users.validator';

const READ_ROLES = [ROLES.QUAN_TRI_VIEN, ROLES.DIEU_HANH, ROLES.QUAN_LY_CHI_NHANH];
const WRITE_ROLES = [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_CHI_NHANH];

export function createUserRouter(service: UserService, authenticate: RequestHandler): Router {
  const router = Router();
  const controller = createUserController(service);

  router.use(authenticate, attachBranchScope);

  router.get('/roles', requireRoles(...READ_ROLES), controller.listRoles);

  router.get('/', requireRoles(...READ_ROLES), ...validate(listUsersValidators), controller.list);

  router.get(
    '/:id',
    requireRoles(...READ_ROLES),
    ...validate(userIdOnlyValidators),
    controller.getById,
  );

  router.post(
    '/',
    requireRoles(...WRITE_ROLES),
    ...validate(createUserValidators),
    controller.create,
  );

  router.put(
    '/:id',
    requireRoles(...WRITE_ROLES),
    ...validate(updateUserValidators),
    controller.update,
  );

  router.patch(
    '/:id/status',
    requireRoles(...WRITE_ROLES),
    ...validate(updateUserStatusValidators),
    controller.changeStatus,
  );

  router.post(
    '/:id/reset-password',
    requireRoles(...WRITE_ROLES),
    ...validate(resetUserPasswordValidators),
    controller.resetPassword,
  );

  router.delete(
    '/:id',
    requireRoles(ROLES.QUAN_TRI_VIEN),
    ...validate(userIdOnlyValidators),
    controller.delete,
  );

  return router;
}
