import { Router, type RequestHandler } from 'express';
import { ROLES } from '../../common/constants';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createVehicleTypeController } from './vehicle-types.controller';
import type { VehicleTypeService } from './vehicle-types.service';
import {
  createVehicleTypeValidators,
  listVehicleTypesValidators,
  updateVehicleTypeValidators,
  vehicleTypeIdValidators,
} from './vehicle-types.validator';

const WRITE_ROLES = [ROLES.QUAN_TRI_VIEN, ROLES.DIEU_HANH];

export function createVehicleTypeRouter(
  service: VehicleTypeService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  const controller = createVehicleTypeController(service);

  router.get('/', ...validate(listVehicleTypesValidators), controller.list);
  router.get('/:id', ...validate(vehicleTypeIdValidators), controller.getById);

  router.post(
    '/',
    authenticate,
    requireRoles(...WRITE_ROLES),
    ...validate(createVehicleTypeValidators),
    controller.create,
  );

  router.put(
    '/:id',
    authenticate,
    requireRoles(...WRITE_ROLES),
    ...validate(updateVehicleTypeValidators),
    controller.update,
  );

  router.delete(
    '/:id',
    authenticate,
    requireRoles(...WRITE_ROLES),
    ...validate(vehicleTypeIdValidators),
    controller.delete,
  );

  return router;
}
