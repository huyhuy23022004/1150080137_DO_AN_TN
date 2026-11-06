import { Router, type RequestHandler } from 'express';
import { ROLES } from '../../common/constants';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createBranchController } from './branches.controller';
import type { BranchService } from './branches.service';
import {
  branchIdValidators,
  createBranchValidators,
  listBranchesValidators,
  updateBranchValidators,
} from './branches.validator';

export function createBranchRouter(service: BranchService, authenticate: RequestHandler): Router {
  const router = Router();
  const controller = createBranchController(service);

  router.get('/', ...validate(listBranchesValidators), controller.list);
  router.get('/:id', ...validate(branchIdValidators), controller.getById);

  router.post(
    '/',
    authenticate,
    requireRoles(ROLES.QUAN_TRI_VIEN),
    ...validate(createBranchValidators),
    controller.create,
  );

  router.put(
    '/:id',
    authenticate,
    requireRoles(ROLES.QUAN_TRI_VIEN),
    ...validate(updateBranchValidators),
    controller.update,
  );

  router.delete(
    '/:id',
    authenticate,
    requireRoles(ROLES.QUAN_TRI_VIEN),
    ...validate(branchIdValidators),
    controller.delete,
  );

  return router;
}
