import { Router, type RequestHandler } from 'express';
import { ipnLimiter } from '../../middlewares/rate-limit.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createPaymentController } from './payments.controller';
import type { PaymentService } from './payments.service';
import { createVnpayUrlValidators } from './payments.validator';

export function createPaymentRouter(service: PaymentService, authenticate: RequestHandler): Router {
  const router = Router();
  const controller = createPaymentController(service);

  router.get('/vnpay/return', controller.vnpayReturn);
  router.get('/vnpay/ipn', ipnLimiter, controller.vnpayIpn);
  router.post(
    '/vnpay/create-url',
    authenticate,
    ...validate(createVnpayUrlValidators),
    controller.createUrl,
  );

  return router;
}
