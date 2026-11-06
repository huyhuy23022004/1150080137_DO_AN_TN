import { Router, type RequestHandler } from 'express';
import { ROLES } from '../../common/constants';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createRouteController } from './routes.controller';
import type { RouteService } from './routes.service';
import {
  createRouteValidators,
  listRoutesValidators,
  routeIdValidators,
  updateRouteValidators,
} from './routes.validator';

const WRITE_ROLES = [ROLES.QUAN_TRI_VIEN, ROLES.DIEU_HANH];

export function createRouteRouter(service: RouteService, authenticate: RequestHandler): Router {
  const router = Router();
  const controller = createRouteController(service);

  router.get('/', ...validate(listRoutesValidators), controller.list);
  router.get('/:id', ...validate(routeIdValidators), controller.getById);

  router.post(
    '/',
    authenticate,
    requireRoles(...WRITE_ROLES),
    ...validate(createRouteValidators),
    controller.create,
  );

  router.put(
    '/:id',
    authenticate,
    requireRoles(...WRITE_ROLES),
    ...validate(updateRouteValidators),
    controller.update,
  );

  router.delete(
    '/:id',
    authenticate,
    requireRoles(...WRITE_ROLES),
    ...validate(routeIdValidators),
    controller.delete,
  );

  return router;
}
