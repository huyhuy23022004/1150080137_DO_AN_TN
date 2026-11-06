import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { config } from './config/env';
import { httpLogger } from './config/logger';
import {
  authService,
  bookingService,
  branchService,
  paymentService,
  routeService,
  statisticsService,
  ticketService,
  tokenService,
  tripService,
  userService,
  vehicleService,
  vehicleTypeService,
} from './container';
import { AppError } from './common/errors/AppError';
import { ERROR_CODES } from './common/errors/error-codes';
import { HTTP_STATUS } from './common/http-status';
import { requestIdMiddleware } from './middlewares/request-id.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { notFoundMiddleware } from './middlewares/not-found.middleware';
import { createHealthRouter } from './routes/health.routes';
import { createApiRouter } from './routes';
import type { AuthService } from './modules/auth/auth.service';
import type { TokenService } from './modules/auth/token.service';
import type { BookingService } from './modules/bookings/bookings.service';
import type { BranchService } from './modules/branches/branches.service';
import type { PaymentService } from './modules/payments/payments.service';
import type { RouteService } from './modules/routes/routes.service';
import type { StatisticsService } from './modules/statistics/statistics.service';
import type { TicketService } from './modules/tickets/tickets.service';
import type { TripService } from './modules/trips/trips.service';
import type { UserService } from './modules/users/users.service';
import type { VehicleTypeService } from './modules/vehicle-types/vehicle-types.service';
import type { VehicleService } from './modules/vehicles/vehicles.service';

export interface AppDependencies {
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

export function createApp(overrides: Partial<AppDependencies> = {}): Express {
  const app = express();
  const dependencies: AppDependencies = {
    authService: overrides.authService ?? authService,
    tokenService: overrides.tokenService ?? tokenService,
    vehicleTypeService: overrides.vehicleTypeService ?? vehicleTypeService,
    vehicleService: overrides.vehicleService ?? vehicleService,
    routeService: overrides.routeService ?? routeService,
    tripService: overrides.tripService ?? tripService,
    branchService: overrides.branchService ?? branchService,
    userService: overrides.userService ?? userService,
    bookingService: overrides.bookingService ?? bookingService,
    paymentService: overrides.paymentService ?? paymentService,
    ticketService: overrides.ticketService ?? ticketService,
    statisticsService: overrides.statisticsService ?? statisticsService,
  };

  app.disable('x-powered-by');
  app.set('trust proxy', config.server.trustProxy);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.cors.origins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(
          new AppError(
            HTTP_STATUS.FORBIDDEN,
            ERROR_CODES.FORBIDDEN,
            'Nguồn yêu cầu không được phép truy cập',
          ),
        );
      },
      credentials: true,
    }),
  );

  app.use(requestIdMiddleware);
  app.use(httpLogger);
  app.use(cookieParser());
  app.use(express.json({ limit: config.server.bodyLimit, strict: true }));
  app.use(express.urlencoded({ extended: false, limit: config.server.bodyLimit }));

  app.use(createHealthRouter());
  app.use(config.server.apiPrefix, createApiRouter(dependencies));

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
