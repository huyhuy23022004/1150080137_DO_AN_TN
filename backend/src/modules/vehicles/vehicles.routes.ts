import { Router, type RequestHandler } from 'express';
import { ROLES } from '../../common/constants';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createVehicleController } from './vehicles.controller';
import type { VehicleService } from './vehicles.service';
import {
  createVehicleValidators,
  listVehiclesValidators,
  updateVehicleValidators,
  vehicleIdValidators,
} from './vehicles.validator';

const READ_ROLES = [ROLES.QUAN_TRI_VIEN, ROLES.DIEU_HANH, ROLES.QUAN_LY_CHI_NHANH];
const WRITE_ROLES = [ROLES.QUAN_TRI_VIEN, ROLES.DIEU_HANH];

export function createVehicleRouter(service: VehicleService, authenticate: RequestHandler): Router {
  const router = Router();
  const controller = createVehicleController(service);

  router.get(
    '/',
    authenticate,
    requireRoles(...READ_ROLES),
    ...validate(listVehiclesValidators),
    controller.list,
  );

  router.get(
    '/:id',
    authenticate,
    requireRoles(...READ_ROLES),
    ...validate(vehicleIdValidators),
    controller.getById,
  );

  router.post(
    '/',
    authenticate,
    requireRoles(...WRITE_ROLES),
    ...validate(createVehicleValidators),
    controller.create,
  );

  router.put(
    '/:id',
    authenticate,
    requireRoles(...WRITE_ROLES),
    ...validate(updateVehicleValidators),
    controller.update,
  );

  router.delete(
    '/:id',
    authenticate,
    requireRoles(...WRITE_ROLES),
    ...validate(vehicleIdValidators),
    controller.delete,
  );

  return router;
}
