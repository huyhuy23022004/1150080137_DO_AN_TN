import { Router, type RequestHandler } from 'express';
import { ROLES } from '../../common/constants';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createBookingController } from './bookings.controller';
import {
  bookingCodeValidators,
  bookingIdValidators,
  createBookingValidators,
  listBookingValidators,
  quoteBookingValidators,
} from './bookings.validator';
import type { BookingService } from './bookings.service';
import type { PaymentService } from '../payments/payments.service';

const LOOKUP_ROLES = [
  ROLES.QUAN_TRI_VIEN,
  ROLES.DIEU_HANH,
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.NHAN_VIEN_PHONG_VE,
];

export function createBookingRouter(
  service: BookingService,
  authenticate: RequestHandler,
  paymentService?: PaymentService,
): Router {
  const router = Router();
  const controller = createBookingController(service, paymentService);

  router.post('/quote', ...validate(quoteBookingValidators), controller.quote);

  router.post('/', authenticate, ...validate(createBookingValidators), controller.create);
  router.get(
    '/',
    authenticate,
    requireRoles(...LOOKUP_ROLES),
    ...validate(listBookingValidators),
    controller.list,
  );
  router.get(
    '/by-code/:code',
    authenticate,
    requireRoles(...LOOKUP_ROLES),
    ...validate(bookingCodeValidators),
    controller.getByCode,
  );
  router.get('/:id', authenticate, ...validate(bookingIdValidators), controller.getById);
  router.post('/:id/cancel', authenticate, ...validate(bookingIdValidators), controller.cancel);
  router.post(
    '/:id/confirm-cash',
    authenticate,
    ...validate(bookingIdValidators),
    controller.confirmCash,
  );

  return router;
}
