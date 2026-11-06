import { config } from './config/env';
import { redis } from './config/redis';
import { RedisOrderCodeGenerator } from './utils/code-generator';
import { PasswordService } from './utils/password';
import { AuthRepository } from './modules/auth/auth.repository';
import { AuthService } from './modules/auth/auth.service';
import { RedisLoginAttemptTracker } from './modules/auth/login-attempt.tracker';
import { RedisRefreshTokenStore } from './modules/auth/refresh-token.store';
import { TokenService } from './modules/auth/token.service';
import { BookingRepository } from './modules/bookings/bookings.repository';
import { BookingService } from './modules/bookings/bookings.service';
import { RedisBookingIdempotencyStore } from './modules/bookings/booking-idempotency.store';
import { PaymentRepository } from './modules/payments/payments.repository';
import { PaymentService } from './modules/payments/payments.service';
import { StatisticsRepository } from './modules/statistics/statistics.repository';
import { StatisticsService } from './modules/statistics/statistics.service';
import { TicketRepository } from './modules/tickets/tickets.repository';
import { TicketService } from './modules/tickets/tickets.service';
import { BranchRepository } from './modules/branches/branches.repository';
import { BranchService } from './modules/branches/branches.service';
import { RouteRepository } from './modules/routes/routes.repository';
import { RouteService } from './modules/routes/routes.service';
import { RedisSeatLockStore } from './modules/seat-locks/redis-seat-lock.store';
import { SeatLockMirrorRepository } from './modules/seat-locks/seat-lock-mirror.repository';
import { SeatLockService } from './modules/seat-locks/seat-locks.service';
import { TripRepository } from './modules/trips/trips.repository';
import { TripService } from './modules/trips/trips.service';
import { UserRepository } from './modules/users/users.repository';
import { UserService } from './modules/users/users.service';
import { VehicleTypeRepository } from './modules/vehicle-types/vehicle-types.repository';
import { VehicleTypeService } from './modules/vehicle-types/vehicle-types.service';
import { VehicleRepository } from './modules/vehicles/vehicles.repository';
import { VehicleService } from './modules/vehicles/vehicles.service';

export const tokenService = new TokenService({
  accessSecret: config.jwt.accessSecret,
  refreshSecret: config.jwt.refreshSecret,
  accessTtlSeconds: config.jwt.accessTtlSeconds,
  refreshTtlSeconds: config.jwt.refreshTtlSeconds,
  issuer: config.jwt.issuer,
  audience: config.jwt.audience,
});

export const passwordService = new PasswordService(config.security.saltRounds);
export const authRepository = new AuthRepository();
export const refreshTokenStore = new RedisRefreshTokenStore(redis);
export const loginAttemptTracker = new RedisLoginAttemptTracker(
  redis,
  config.security.loginMaxFailedAttempts,
  config.security.loginLockSeconds,
);

export const authService = new AuthService({
  repository: authRepository,
  refreshTokenStore,
  loginAttemptTracker,
  tokenService,
  passwordService,
  refreshTtlSeconds: config.jwt.refreshTtlSeconds,
});

export const vehicleTypeRepository = new VehicleTypeRepository();
export const vehicleTypeService = new VehicleTypeService(vehicleTypeRepository);

export const vehicleRepository = new VehicleRepository();
export const vehicleService = new VehicleService(vehicleRepository);

export const routeRepository = new RouteRepository();
export const routeService = new RouteService(routeRepository);

export const branchRepository = new BranchRepository();
export const branchService = new BranchService(branchRepository);

export const userRepository = new UserRepository();
export const userService = new UserService(userRepository, passwordService);

export const tripRepository = new TripRepository();
export const seatLockStore = new RedisSeatLockStore(redis);
export const seatLockMirrorRepository = new SeatLockMirrorRepository();
export const seatLockService = new SeatLockService({
  store: seatLockStore,
  mirror: seatLockMirrorRepository,
  catalog: tripRepository,
  ttlSeconds: config.seatLock.ttlSeconds,
  maxExtendSeconds: config.seatLock.maxExtendSeconds,
  maxSeatsPerOrder: config.booking.maxSeatsPerOrder,
  tripBookingCloseMinutes: config.booking.tripBookingCloseMinutes,
  mirrorEnabled: config.seatLock.mirrorEnabled,
});
export const tripService = new TripService(tripRepository, seatLockService);

export const bookingRepository = new BookingRepository();
export const orderCodeGenerator = new RedisOrderCodeGenerator(redis);
export const bookingIdempotencyStore = new RedisBookingIdempotencyStore(redis);
export const bookingService = new BookingService({
  repository: bookingRepository,
  seatLocks: seatLockService,
  orderCodeGenerator,
  idempotencyStore: bookingIdempotencyStore,
  customerProfiles: authRepository,
});

export const paymentRepository = new PaymentRepository();
export const paymentService = new PaymentService({ repository: paymentRepository });

export const ticketRepository = new TicketRepository();
export const ticketService = new TicketService({ repository: ticketRepository });

export const statisticsRepository = new StatisticsRepository();
export const statisticsService = new StatisticsService({ repository: statisticsRepository });
