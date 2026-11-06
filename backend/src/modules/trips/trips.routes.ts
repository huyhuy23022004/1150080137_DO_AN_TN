import { Router, type RequestHandler } from 'express';
import { ROLES } from '../../common/constants';
import { attachBranchScope, requireRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createTripController } from './trips.controller';
import type { TripService } from './trips.service';
import {
  createTripValidators,
  listAssignedTripsValidators,
  listTripsValidators,
  searchTripsValidators,
  tripIdValidators,
  updateTripStatusValidators,
  updateTripValidators,
} from './trips.validator';

const MANAGEMENT_ROLES = [ROLES.QUAN_TRI_VIEN, ROLES.DIEU_HANH, ROLES.QUAN_LY_CHI_NHANH];

export function createTripRouter(service: TripService): Router {
  const router = Router();
  const controller = createTripController(service);

  router.get('/', ...validate(searchTripsValidators), controller.search);
  router.get('/:id/seat-map', ...validate(tripIdValidators), controller.getSeatMap);
  router.get('/:id', ...validate(tripIdValidators), controller.getPublicById);

  return router;
}

export function createDriverTripRouter(service: TripService, authenticate: RequestHandler): Router {
  const router = Router();
  const controller = createTripController(service);

  router.use(authenticate, requireRoles(ROLES.TAI_XE));

  router.get('/', ...validate(listAssignedTripsValidators), controller.listAssigned);

  return router;
}

export function createAdminTripRouter(service: TripService, authenticate: RequestHandler): Router {
  const router = Router();
  const controller = createTripController(service);

  router.use(authenticate, attachBranchScope, requireRoles(...MANAGEMENT_ROLES));

  router.get('/', ...validate(listTripsValidators), controller.list);
  router.get('/:id', ...validate(tripIdValidators), controller.getManagedById);

  router.post('/', ...validate(createTripValidators), controller.create);

  router.put('/:id', ...validate(updateTripValidators), controller.update);

  router.patch('/:id/status', ...validate(updateTripStatusValidators), controller.changeStatus);

  router.delete('/:id', ...validate(tripIdValidators), controller.delete);

  return router;
}
