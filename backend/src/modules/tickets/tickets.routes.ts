import { Router, type RequestHandler } from 'express';
import { ROLES } from '../../common/constants';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createTicketController } from './tickets.controller';
import type { TicketService } from './tickets.service';
import {
  checkinValidators,
  listMyTicketsValidators,
  ticketIdValidators,
  tripPassengersValidators,
} from './tickets.validator';

const PASSENGER_VIEW_ROLES = [
  ROLES.QUAN_TRI_VIEN,
  ROLES.DIEU_HANH,
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.TAI_XE,
];

export function createTicketRouter(service: TicketService, authenticate: RequestHandler): Router {
  const router = Router();
  const controller = createTicketController(service);

  router.use(authenticate);

  router.get('/my', ...validate(listMyTicketsValidators), controller.listMine);
  router.get(
    '/trips/:tripId/passengers',
    requireRoles(...PASSENGER_VIEW_ROLES),
    ...validate(tripPassengersValidators),
    controller.listPassengers,
  );
  router.post(
    '/check-in',
    requireRoles(ROLES.TAI_XE),
    ...validate(checkinValidators),
    controller.checkIn,
  );
  router.get('/:id/qr', ...validate(ticketIdValidators), controller.getQr);
  router.get('/:id', ...validate(ticketIdValidators), controller.getById);

  return router;
}
