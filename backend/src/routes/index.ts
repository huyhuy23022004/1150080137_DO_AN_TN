import { Router } from 'express';
import { sendSuccess } from '../common/response';
import { createAuthMiddleware } from '../middlewares/auth.middleware';
import { globalLimiter } from '../middlewares/rate-limit.middleware';
import { createAuthRouter } from '../modules/auth/auth.routes';
import type { AuthService } from '../modules/auth/auth.service';
import type { TokenService } from '../modules/auth/token.service';
import { createBookingRouter } from '../modules/bookings/bookings.routes';
import type { BookingService } from '../modules/bookings/bookings.service';
import { createBranchRouter } from '../modules/branches/branches.routes';
import type { BranchService } from '../modules/branches/branches.service';
import { createPaymentRouter } from '../modules/payments/payments.routes';
import type { PaymentService } from '../modules/payments/payments.service';
import { createRouteRouter } from '../modules/routes/routes.routes';
import { createStatisticsRouter } from '../modules/statistics/statistics.routes';
import type { StatisticsService } from '../modules/statistics/statistics.service';
import { createTicketRouter } from '../modules/tickets/tickets.routes';
import type { TicketService } from '../modules/tickets/tickets.service';
import type { RouteService } from '../modules/routes/routes.service';
import {
  createAdminTripRouter,
  createDriverTripRouter,
  createTripRouter,
} from '../modules/trips/trips.routes';
import type { TripService } from '../modules/trips/trips.service';
import { createUserRouter } from '../modules/users/users.routes';
import type { UserService } from '../modules/users/users.service';
import { createVehicleTypeRouter } from '../modules/vehicle-types/vehicle-types.routes';
import type { VehicleTypeService } from '../modules/vehicle-types/vehicle-types.service';
import { createVehicleRouter } from '../modules/vehicles/vehicles.routes';
import type { VehicleService } from '../modules/vehicles/vehicles.service';

export interface ApiRouterDependencies {
  authService: AuthService;
  tokenService: TokenService;
  vehicleTypeService: VehicleTypeService;
  vehicleService: VehicleService;
  routeService: RouteService;
  tripService: TripService;
  branchService: BranchService;
  userService: UserService;
  bookingService: BookingService;
  paymentService: PaymentService;
  ticketService: TicketService;
  statisticsService: StatisticsService;
}

export function createApiRouter(dependencies: ApiRouterDependencies): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(dependencies.tokenService);

  router.use(globalLimiter);

  router.get('/', (_req, res) => {
    sendSuccess(res, {
      name: 'FUTA Bus System API',
      version: 'v1',
      status: 'running',
    });
  });

  router.use('/auth', createAuthRouter(dependencies.authService, dependencies.tokenService));
  router.use(
    '/vehicle-types',
    createVehicleTypeRouter(dependencies.vehicleTypeService, authenticate),
  );
  router.use('/vehicles', createVehicleRouter(dependencies.vehicleService, authenticate));
  router.use('/routes', createRouteRouter(dependencies.routeService, authenticate));
  router.use('/branches', createBranchRouter(dependencies.branchService, authenticate));
  router.use('/users', createUserRouter(dependencies.userService, authenticate));
  router.use('/trips', createTripRouter(dependencies.tripService));
  router.use('/driver/trips', createDriverTripRouter(dependencies.tripService, authenticate));
  router.use('/admin/trips', createAdminTripRouter(dependencies.tripService, authenticate));
  router.use(
    '/bookings',
    createBookingRouter(dependencies.bookingService, authenticate, dependencies.paymentService),
  );
  router.use('/payments', createPaymentRouter(dependencies.paymentService, authenticate));
  router.use('/tickets', createTicketRouter(dependencies.ticketService, authenticate));
  router.use('/statistics', createStatisticsRouter(dependencies.statisticsService, authenticate));

  return router;
}
