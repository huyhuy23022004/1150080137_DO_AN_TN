import { TRIP_STATUS } from '../trips/trips.types';
import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { HTTP_STATUS } from '../../common/http-status';
import { logger } from '../../config/logger';
import { holdSessionMember, seatLockKey } from '../../utils/redis-keys';
import type {
  ExtendSeatRequest,
  HeldSeatResult,
  HoldSeatRequest,
  ReleaseSeatRequest,
  SeatCatalogPort,
  SeatLockMirrorPort,
  SeatLockStorePort,
  SeatLockTripRecord,
} from './seat-locks.types';

const OWNER_REF_PATTERN = /^[A-Za-z0-9_-]{8,50}$/;
const SEAT_CODE_PATTERN = /^[A-Z0-9_-]{1,10}$/;
const BOOKING_VERIFY_TTL_MS = 30_000;

export interface SeatLockServiceDependencies {
  store: SeatLockStorePort;
  mirror: SeatLockMirrorPort;
  catalog: SeatCatalogPort;
  ttlSeconds: number;
  maxExtendSeconds: number;
  maxSeatsPerOrder: number;
  tripBookingCloseMinutes: number;
  mirrorEnabled?: boolean;
  now?: () => Date;
}

function seatConflictError(seats: string[]): AppError {
  return new AppError(
    HTTP_STATUS.CONFLICT,
    ERROR_CODES.SEAT_CONFLICT,
    'Một số ghế đã được người khác giữ hoặc đã bán',
    { danh_sach_ghe: seats },
  );
}

function lockUnavailableError(error: unknown): AppError {
  logger.error({ err: error }, 'seat_lock_store_unavailable');
  return new AppError(
    HTTP_STATUS.SERVICE_UNAVAILABLE,
    ERROR_CODES.SEAT_LOCK_UNAVAILABLE,
    'Tính năng giữ ghế tạm thời không khả dụng, vui lòng thử lại sau',
  );
}

export class SeatLockService {
  private readonly mirrorEnabled: boolean;
  private readonly now: () => Date;

  public constructor(private readonly dependencies: SeatLockServiceDependencies) {
    this.mirrorEnabled = dependencies.mirrorEnabled ?? true;
    this.now = dependencies.now ?? (() => new Date());
  }

  public async hold(request: HoldSeatRequest): Promise<HeldSeatResult> {
    const ownerRef = this.normalizeOwnerRef(request.owner_ref);
    const seats = this.normalizeSeats(request.danh_sach_ghe);
    const trip = await this.requireBookableTrip(request.ma_chuyen);
    await this.validateSeats(trip, seats);

    await this.safeHydrateTrip(trip.ma_chuyen);

    const keys = seats.map((seat) => seatLockKey(trip.ma_chuyen, seat));
    let conflictSeats: string[] = [];

    try {
      const result = await this.dependencies.store.acquire(
        keys,
        ownerRef,
        this.dependencies.ttlSeconds * 1_000,
      );

      if (!result.ok) {
        const conflictSeat = seats[keys.indexOf(result.conflictKey)] ?? seats[0];
        conflictSeats = conflictSeat ? [conflictSeat] : [];
        throw seatConflictError(conflictSeats);
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw lockUnavailableError(error);
    }

    const expiresAt = new Date(this.now().getTime() + this.dependencies.ttlSeconds * 1_000);

    await this.persistHold(ownerRef, trip.ma_chuyen, seats, expiresAt, request);

    return {
      ma_chuyen: trip.ma_chuyen,
      danh_sach_ghe: seats,
      owner_ref: ownerRef,
      expires_at: expiresAt.toISOString(),
      ttl_seconds: this.dependencies.ttlSeconds,
    };
  }

  public async extend(request: ExtendSeatRequest): Promise<HeldSeatResult> {
    const ownerRef = this.normalizeOwnerRef(request.owner_ref);
    const members = await this.sessionMembersForTrip(ownerRef, request.ma_chuyen);

    if (members.length === 0) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.SEAT_LOCK_NOT_OWNED,
        'Không tìm thấy ghế nào đang được giữ bởi phiên này',
      );
    }

    const seats = members.map((member) => member.slice(String(request.ma_chuyen).length + 1));
    const keys = seats.map((seat) => seatLockKey(request.ma_chuyen, seat));
    const ttlSeconds = Math.min(
      this.dependencies.ttlSeconds * 2,
      this.dependencies.maxExtendSeconds,
    );

    try {
      const extended = await this.dependencies.store.extend(keys, ownerRef, ttlSeconds * 1_000);
      if (!extended) {
        throw new AppError(
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.SEAT_LOCK_NOT_OWNED,
          'Phiên giữ ghế đã hết hạn hoặc không còn quyền giữ ghế',
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw lockUnavailableError(error);
    }

    const expiresAt = new Date(this.now().getTime() + ttlSeconds * 1_000);
    await this.persistMirror(request.ma_chuyen, seats, ownerRef, expiresAt, ownerRef);

    try {
      await this.dependencies.store.addToSession(ownerRef, members, ttlSeconds);
    } catch (error) {
      logger.warn({ err: error, ownerRef }, 'seat_lock_session_extend_failed');
    }

    return {
      ma_chuyen: request.ma_chuyen,
      danh_sach_ghe: seats,
      owner_ref: ownerRef,
      expires_at: expiresAt.toISOString(),
      ttl_seconds: ttlSeconds,
    };
  }

  public async release(request: ReleaseSeatRequest): Promise<{ danh_sach_ghe: string[] }> {
    const ownerRef = this.normalizeOwnerRef(request.owner_ref);
    let seats: string[];

    if (request.danh_sach_ghe !== undefined) {
      seats = this.normalizeSeats(request.danh_sach_ghe);
    } else {
      const members = await this.sessionMembersForTrip(ownerRef, request.ma_chuyen);
      seats = members.map((member) => member.slice(String(request.ma_chuyen).length + 1));
    }

    if (seats.length === 0) {
      return { danh_sach_ghe: [] };
    }

    const keys = seats.map((seat) => seatLockKey(request.ma_chuyen, seat));

    try {
      await this.dependencies.store.release(keys, ownerRef);
    } catch (error) {
      throw lockUnavailableError(error);
    }

    await this.removeMirror(request.ma_chuyen, seats);
    await this.removeSessionMembers(
      ownerRef,
      seats.map((seat) => holdSessionMember(request.ma_chuyen, seat)),
    );

    return { danh_sach_ghe: seats };
  }

  public async releaseAll(
    ownerRefValue: string,
  ): Promise<Array<{ ma_chuyen: number; danh_sach_ghe: string[] }>> {
    const ownerRef = this.normalizeOwnerRef(ownerRefValue);
    let members: string[];

    try {
      members = await this.dependencies.store.getSessionMembers(ownerRef);
    } catch (error) {
      throw lockUnavailableError(error);
    }

    const grouped = new Map<number, string[]>();

    for (const member of members) {
      const separator = member.indexOf(':');
      if (separator <= 0) {
        continue;
      }

      const tripId = Number(member.slice(0, separator));
      const seatCode = member.slice(separator + 1);
      if (!Number.isInteger(tripId) || !seatCode) {
        continue;
      }

      const seats = grouped.get(tripId) ?? [];
      seats.push(seatCode);
      grouped.set(tripId, seats);
    }

    const released: Array<{ ma_chuyen: number; danh_sach_ghe: string[] }> = [];

    for (const [tripId, seats] of grouped) {
      const keys = seats.map((seat) => seatLockKey(tripId, seat));

      try {
        await this.dependencies.store.release(keys, ownerRef);
      } catch (error) {
        logger.warn({ err: error, ownerRef, tripId }, 'seat_lock_release_all_failed');
        continue;
      }

      await this.removeMirror(tripId, seats);
      released.push({ ma_chuyen: tripId, danh_sach_ghe: seats });
    }

    try {
      await this.dependencies.store.removeFromSession(ownerRef, members);
    } catch (error) {
      logger.warn({ err: error, ownerRef }, 'seat_lock_session_cleanup_failed');
    }

    return released;
  }

  public async verifyForBooking(
    tripId: number,
    seatCodes: string[],
    ownerRefValue: string,
  ): Promise<void> {
    const ownerRef = this.normalizeOwnerRef(ownerRefValue);
    const seats = this.normalizeSeats(seatCodes);
    const keys = seats.map((seat) => seatLockKey(tripId, seat));

    try {
      const owned = await this.dependencies.store.verifyAndExtend(
        keys,
        ownerRef,
        BOOKING_VERIFY_TTL_MS,
      );

      if (owned) {
        return;
      }

      const owners = await this.dependencies.store.getOwners(keys);
      const conflicts = seats.filter((_seat, index) => owners[index] !== ownerRef);
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.SEAT_LOCK_NOT_OWNED,
        'Phiên giữ ghế đã hết hạn hoặc không thuộc về bạn',
        { danh_sach_ghe: conflicts },
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw lockUnavailableError(error);
    }
  }

  public async consumeAfterBooking(
    tripId: number,
    seatCodes: string[],
    ownerRefValue: string,
  ): Promise<void> {
    const ownerRef = this.normalizeOwnerRef(ownerRefValue);
    const seats = this.normalizeSeats(seatCodes);
    const keys = seats.map((seat) => seatLockKey(tripId, seat));

    try {
      await this.dependencies.store.release(keys, ownerRef);
    } catch (error) {
      logger.warn({ err: error, tripId, ownerRef }, 'seat_lock_consume_failed');
    }

    await this.removeMirror(tripId, seats);
    await this.removeSessionMembers(
      ownerRef,
      seats.map((seat) => holdSessionMember(tripId, seat)),
    );
  }

  public async getActiveSeatCodes(tripId: number): Promise<Set<string>> {
    const result = new Set<string>();

    try {
      const locks = await this.dependencies.store.getTripLocks(tripId);
      for (const lock of locks) {
        result.add(lock.ky_hieu_ghe);
      }
    } catch (error) {
      logger.warn({ err: error, tripId }, 'seat_lock_read_failed_using_mirror');
    }

    try {
      const mirrorSeats = await this.dependencies.mirror.findActiveSeatCodes(tripId);
      for (const seat of mirrorSeats) {
        result.add(seat);
      }
    } catch (error) {
      logger.warn({ err: error, tripId }, 'seat_lock_mirror_read_failed');
    }

    return result;
  }

  public async hydrateTrip(tripId: number): Promise<void> {
    const entries = await this.dependencies.mirror.findActiveEntries(tripId);
    const now = this.now().getTime();

    for (const entry of entries) {
      const remainingMs = entry.expires_at.getTime() - now;
      if (remainingMs <= 0) {
        continue;
      }

      try {
        const result = await this.dependencies.store.acquire(
          [seatLockKey(entry.ma_chuyen, entry.ky_hieu_ghe)],
          entry.owner_ref,
          remainingMs,
        );

        if (result.ok) {
          await this.dependencies.store.addToSession(
            entry.owner_ref,
            [holdSessionMember(entry.ma_chuyen, entry.ky_hieu_ghe)],
            Math.max(Math.ceil(remainingMs / 1_000), 1),
          );
        }
      } catch (error) {
        logger.warn({ err: error, tripId, seat: entry.ky_hieu_ghe }, 'seat_lock_hydrate_failed');
      }
    }
  }

  public async sweepExpiredMirror(): Promise<number> {
    return this.dependencies.mirror.deleteExpired();
  }

  private normalizeOwnerRef(value: string): string {
    const ownerRef = value.trim();

    if (!OWNER_REF_PATTERN.test(ownerRef)) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'owner_ref phải có từ 8 đến 50 ký tự chữ, số, gạch ngang hoặc gạch dưới',
      );
    }

    return ownerRef;
  }

  private normalizeSeats(values: string[]): string[] {
    if (!Array.isArray(values) || values.length === 0) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Danh sách ghế không được để trống',
      );
    }

    const seats = Array.from(
      new Set(values.map((value) => String(value).trim().toUpperCase()).filter(Boolean)),
    );

    if (seats.length > this.dependencies.maxSeatsPerOrder) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        `Mỗi lần chỉ được chọn tối đa ${this.dependencies.maxSeatsPerOrder} ghế`,
      );
    }

    if (seats.some((seat) => !SEAT_CODE_PATTERN.test(seat))) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Ký hiệu ghế không hợp lệ',
      );
    }

    return seats;
  }

  private async requireBookableTrip(tripId: number): Promise<SeatLockTripRecord> {
    const trip = await this.dependencies.catalog.findById(tripId);

    if (!trip) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.TRIP_NOT_FOUND,
        'Không tìm thấy chuyến xe',
      );
    }

    if (trip.trang_thai !== TRIP_STATUS.SAP_CHAY) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TRIP_NOT_BOOKABLE,
        'Chuyến xe không ở trạng thái có thể đặt vé',
      );
    }

    const departure = new Date(trip.thoi_gian_xuat_ben).getTime();
    const cutoff = this.now().getTime() + this.dependencies.tripBookingCloseMinutes * 60_000;

    if (Number.isNaN(departure) || departure <= cutoff) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.TRIP_NOT_BOOKABLE,
        'Đã quá thời gian cho phép đặt vé cho chuyến xe này',
      );
    }

    return trip;
  }

  private async validateSeats(trip: SeatLockTripRecord, seats: string[]): Promise<void> {
    const [layout, booked] = await Promise.all([
      this.dependencies.catalog.findSeatLayout(trip.ma_loai_xe),
      this.dependencies.catalog.findBookedSeatCodes(trip.ma_chuyen),
    ]);

    const layoutSeats = new Set(layout.map((seat) => seat.ky_hieu_ghe));
    const missing = seats.filter((seat) => !layoutSeats.has(seat));

    if (missing.length > 0) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.SEAT_NOT_FOUND,
        'Một số ghế không tồn tại trong sơ đồ của chuyến',
        { danh_sach_ghe: missing },
      );
    }

    const conflicts = seats.filter((seat) => booked.has(seat));
    if (conflicts.length > 0) {
      throw seatConflictError(conflicts);
    }
  }

  private async persistHold(
    ownerRef: string,
    tripId: number,
    seats: string[],
    expiresAt: Date,
    request: HoldSeatRequest,
  ): Promise<void> {
    const members = seats.map((seat) => holdSessionMember(tripId, seat));

    try {
      await this.dependencies.store.addToSession(ownerRef, members, this.dependencies.ttlSeconds);

      await this.dependencies.store.saveMeta(
        ownerRef,
        JSON.stringify({
          owner_ref: ownerRef,
          ma_nguoi_dung: request.ma_nguoi_dung ?? null,
          socket_id: request.socket_id ?? null,
          ma_chuyen: tripId,
          danh_sach_ghe: seats,
          expires_at: expiresAt.toISOString(),
        }),
        this.dependencies.ttlSeconds,
      );
    } catch (error) {
      logger.warn({ err: error, ownerRef, tripId }, 'seat_lock_session_write_failed');
    }

    await this.persistMirror(tripId, seats, ownerRef, expiresAt);
  }

  private async persistMirror(
    tripId: number,
    seats: string[],
    ownerRef: string,
    expiresAt: Date,
    _ownerForLog?: string,
  ): Promise<void> {
    if (!this.mirrorEnabled) {
      return;
    }

    try {
      await this.dependencies.mirror.upsertMany(
        seats.map((seat) => ({
          ma_chuyen: tripId,
          ky_hieu_ghe: seat,
          owner_ref: ownerRef,
          expires_at: expiresAt,
        })),
      );
    } catch (error) {
      logger.warn({ err: error, tripId, ownerRef }, 'seat_lock_mirror_write_failed');
    }
  }

  private async removeMirror(tripId: number, seats: string[]): Promise<void> {
    if (!this.mirrorEnabled) {
      return;
    }

    try {
      await this.dependencies.mirror.deleteMany(tripId, seats);
    } catch (error) {
      logger.warn({ err: error, tripId }, 'seat_lock_mirror_delete_failed');
    }
  }

  private async removeSessionMembers(ownerRef: string, members: string[]): Promise<void> {
    try {
      await this.dependencies.store.removeFromSession(ownerRef, members);
    } catch (error) {
      logger.warn({ err: error, ownerRef }, 'seat_lock_session_remove_failed');
    }
  }

  private async sessionMembersForTrip(ownerRef: string, tripId: number): Promise<string[]> {
    let members: string[];

    try {
      members = await this.dependencies.store.getSessionMembers(ownerRef);
    } catch (error) {
      throw lockUnavailableError(error);
    }

    const prefix = `${tripId}:`;
    return members.filter((member) => member.startsWith(prefix));
  }

  private async safeHydrateTrip(tripId: number): Promise<void> {
    try {
      await this.hydrateTrip(tripId);
    } catch (error) {
      logger.warn({ err: error, tripId }, 'seat_lock_hydrate_skipped');
    }
  }
}
