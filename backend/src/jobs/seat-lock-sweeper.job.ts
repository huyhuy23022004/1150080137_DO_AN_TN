import { logger } from '../config/logger';
import type { SeatLockService } from '../modules/seat-locks/seat-locks.service';
import type { JobLockPort } from './job-lock';

export class SeatLockSweeperJob {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  public constructor(
    private readonly seatLockService: SeatLockService,
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
      if (!(await this.lock.tryAcquire('seat-lock-sweep', this.intervalMs * 2))) {
        return;
      }

      const deleted = await this.seatLockService.sweepExpiredMirror();
      if (deleted > 0) {
        logger.info({ deleted }, 'seat_lock_mirror_swept');
      }
    } catch (error) {
      logger.error({ err: error }, 'seat_lock_sweep_job_failed');
    } finally {
      this.running = false;
    }
  }
}
