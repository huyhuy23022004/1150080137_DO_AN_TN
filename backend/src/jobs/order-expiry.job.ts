import { logger } from '../config/logger';
import type { BookingService } from '../modules/bookings/bookings.service';
import type { JobLockPort } from './job-lock';

export class OrderExpiryJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  public constructor(
    private readonly bookingService: BookingService,
    private readonly lock: JobLockPort,
    private readonly intervalMs: number,
  ) {}

  public start(): void {
    if (this.timer) {
      return;
    }

    void this.runOnce();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
    this.timer.unref();
  }

  public stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  public async runOnce(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      if (!(await this.lock.tryAcquire('booking-expiry', this.intervalMs * 2))) {
        return;
      }

      const expired = await this.bookingService.expirePendingOrders(50);
      if (expired.length > 0) {
        logger.info(
          { count: expired.length, orderIds: expired.map((order) => order.ma_don_ve) },
          'booking_expiry_cancelled_orders',
        );
      }
    } catch (error) {
      logger.error({ err: error }, 'booking_expiry_job_failed');
    } finally {
      this.running = false;
    }
  }
}
