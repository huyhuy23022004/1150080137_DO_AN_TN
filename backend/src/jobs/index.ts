import { config } from '../config/env';
import { redis } from '../config/redis';
import { bookingService, seatLockService } from '../container';
import { RedisJobLock } from './job-lock';
import { OrderExpiryJob } from './order-expiry.job';
import { SeatLockSweeperJob } from './seat-lock-sweeper.job';

const jobLock = new RedisJobLock(redis);

const orderExpiryJob = new OrderExpiryJob(
  bookingService,
  jobLock,
  config.booking.expiryScanIntervalSeconds * 1_000,
);

const seatLockSweeperJob = new SeatLockSweeperJob(
  seatLockService,
  jobLock,
  config.seatLock.sweepIntervalSeconds * 1_000,
);

export function startScheduledJobs(): void {
  orderExpiryJob.start();
  seatLockSweeperJob.start();
}

export function stopScheduledJobs(): void {
  orderExpiryJob.stop();
  seatLockSweeperJob.stop();
}
