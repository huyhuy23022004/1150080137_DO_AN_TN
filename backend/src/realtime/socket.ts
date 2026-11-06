import type http from 'node:http';
import type { Server as SocketServer, Socket } from 'socket.io';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import { config } from '../config/env';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { AppError } from '../common/errors/AppError';
import { ERROR_CODES } from '../common/errors/error-codes';
import type { TokenService } from '../modules/auth/token.service';
import type { SeatLockService } from '../modules/seat-locks/seat-locks.service';
import type { TripService } from '../modules/trips/trips.service';
import {
  onSeatBooked,
  onSeatHeld,
  onSeatReleased,
  publishSeatHeld,
  publishSeatReleased,
  type SeatBookedRealtimeEvent,
  type SeatHeldRealtimeEvent,
  type SeatReleasedRealtimeEvent,
} from './events';

export interface RealtimeDependencies {
  tokenService: TokenService;
  seatLockService: SeatLockService;
  tripService: TripService;
}

export interface RealtimeServer {
  io: SocketServer;
  close(): Promise<void>;
}

interface SocketAckResponse {
  success: boolean;
  data?: unknown;
  code?: string;
  message?: string;
  details?: unknown;
}

type SocketAck = (response: SocketAckResponse) => void;

interface SocketSession {
  owner_ref: string | null;
  holdTimestamps: number[];
  user: {
    ma_nguoi_dung: string;
    ten_vai_tro: string;
  } | null;
}

const ROOM_PREFIX = 'trip:';
const BEARER_PATTERN = /^Bearer\s+(.+)$/i;
const OWNER_REF_PATTERN = /^[A-Za-z0-9_-]{8,50}$/;
const SEAT_CODE_PATTERN = /^[A-Z0-9_-]{1,10}$/;

function tripRoom(tripId: number): string {
  return `${ROOM_PREFIX}${tripId}`;
}

function emitHeld(io: SocketServer, event: SeatHeldRealtimeEvent): void {
  io.to(tripRoom(event.ma_chuyen)).emit('seat:held', {
    ma_chuyen: event.ma_chuyen,
    danh_sach_ghe: event.danh_sach_ghe,
    expires_at: event.expires_at,
    ttl_seconds: event.ttl_seconds,
  });
}

function emitReleased(io: SocketServer, event: SeatReleasedRealtimeEvent): void {
  io.to(tripRoom(event.ma_chuyen)).emit('seat:released', {
    ma_chuyen: event.ma_chuyen,
    danh_sach_ghe: event.danh_sach_ghe,
    reason: event.reason,
  });
}

function emitBooked(io: SocketServer, event: SeatBookedRealtimeEvent): void {
  io.to(tripRoom(event.ma_chuyen)).emit('seat:booked', {
    ma_chuyen: event.ma_chuyen,
    danh_sach_ghe: event.danh_sach_ghe,
    ma_don_ve: event.ma_don_ve,
    trang_thai_don: event.trang_thai_don,
  });
}

function reply(ack: unknown, response: SocketAckResponse): void {
  if (typeof ack === 'function') {
    (ack as SocketAck)(response);
  }
}

function toSocketError(error: unknown): SocketAckResponse {
  if (error instanceof AppError) {
    return {
      success: false,
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }

  logger.error({ err: error }, 'socket_event_failed');
  return {
    success: false,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau',
  };
}

function validationFailure(message: string): SocketAckResponse {
  return {
    success: false,
    code: ERROR_CODES.VALIDATION_ERROR,
    message,
  };
}

function parseTripId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseSeatList(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > config.booking.maxSeatsPerOrder ||
    !value.every(
      (seat) => typeof seat === 'string' && SEAT_CODE_PATTERN.test(seat.trim().toUpperCase()),
    )
  ) {
    return null;
  }

  return Array.from(new Set(value.map((seat) => seat.trim().toUpperCase())));
}

function parseOwnerRef(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const ownerRef = value.trim();
  return OWNER_REF_PATTERN.test(ownerRef) ? ownerRef : null;
}

function extractToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header !== 'string') {
    return null;
  }

  return BEARER_PATTERN.exec(header)?.[1] ?? null;
}

function ensureSession(socket: Socket): SocketSession {
  return socket.data as unknown as SocketSession;
}

export async function createRealtimeServer(
  server: http.Server,
  dependencies: RealtimeDependencies,
): Promise<RealtimeServer> {
  const io = new Server(server, {
    path: config.socket.path,
    cors: {
      origin: config.socket.corsOrigins,
      credentials: true,
    },
    pingInterval: config.socket.pingIntervalMs,
    pingTimeout: config.socket.pingTimeoutMs,
  });

  let pubClient: Redis | null = null;
  let subClient: Redis | null = null;

  if (!config.isTest) {
    try {
      pubClient = redis.duplicate();
      subClient = redis.duplicate();
      pubClient.on('error', (error) => logger.warn({ err: error }, 'socket_redis_pub_error'));
      subClient.on('error', (error) => logger.warn({ err: error }, 'socket_redis_sub_error'));
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('socket_redis_adapter_connected');
    } catch (error) {
      logger.warn({ err: error }, 'socket_redis_adapter_unavailable');
      pubClient?.disconnect();
      subClient?.disconnect();
      pubClient = null;
      subClient = null;
    }
  }

  io.use((socket, next) => {
    const token = extractToken(socket);
    const session = ensureSession(socket);
    session.owner_ref = null;
    session.holdTimestamps = [];
    session.user = null;

    if (!token) {
      next();
      return;
    }

    try {
      const claims = dependencies.tokenService.verifyAccessToken(token);
      session.user = {
        ma_nguoi_dung: claims.sub,
        ten_vai_tro: claims.ten_vai_tro,
      };
      next();
    } catch {
      next(new Error(ERROR_CODES.AUTH_TOKEN_INVALID));
    }
  });

  io.on('connection', (socket) => {
    const session = ensureSession(socket);

    socket.on('trip:join', async (payload: unknown, ack: unknown) => {
      try {
        const body = payload as { ma_chuyen?: unknown } | null;
        const tripId = parseTripId(body?.ma_chuyen);
        if (tripId === null) {
          reply(ack, validationFailure('Mã chuyến không hợp lệ'));
          return;
        }

        const seatMap = await dependencies.tripService.getSeatMap(tripId);
        await socket.join(tripRoom(tripId));
        reply(ack, { success: true, data: { so_do_ghe: seatMap } });
      } catch (error) {
        reply(ack, toSocketError(error));
      }
    });

    socket.on('trip:leave', async (payload: unknown, ack: unknown) => {
      const body = payload as { ma_chuyen?: unknown } | null;
      const tripId = parseTripId(body?.ma_chuyen);
      if (tripId === null) {
        reply(ack, validationFailure('Mã chuyến không hợp lệ'));
        return;
      }

      await socket.leave(tripRoom(tripId));
      reply(ack, { success: true });
    });

    socket.on('seat:hold', async (payload: unknown, ack: unknown) => {
      try {
        const now = Date.now();
        session.holdTimestamps = session.holdTimestamps.filter(
          (timestamp) => now - timestamp < config.rateLimit.windowMs,
        );

        if (session.holdTimestamps.length >= config.rateLimit.holdMax) {
          reply(ack, {
            success: false,
            code: ERROR_CODES.RATE_LIMITED,
            message: 'Bạn thao tác giữ ghế quá nhanh, vui lòng thử lại sau',
          });
          return;
        }

        const body = payload as {
          ma_chuyen?: unknown;
          danh_sach_ghe?: unknown;
          owner_ref?: unknown;
        } | null;
        const tripId = parseTripId(body?.ma_chuyen);
        const seats = parseSeatList(body?.danh_sach_ghe);
        const ownerRef = parseOwnerRef(body?.owner_ref);

        if (tripId === null || !seats || !ownerRef) {
          reply(ack, validationFailure('Dữ liệu giữ ghế không hợp lệ'));
          return;
        }

        session.holdTimestamps.push(now);
        session.owner_ref = ownerRef;

        const result = await dependencies.seatLockService.hold({
          ma_chuyen: tripId,
          danh_sach_ghe: seats,
          owner_ref: ownerRef,
          socket_id: socket.id,
          ma_nguoi_dung: session.user?.ma_nguoi_dung ?? null,
        });

        publishSeatHeld({
          ma_chuyen: result.ma_chuyen,
          danh_sach_ghe: result.danh_sach_ghe,
          owner_ref: result.owner_ref,
          expires_at: result.expires_at,
          ttl_seconds: result.ttl_seconds,
        });

        reply(ack, { success: true, data: result });
      } catch (error) {
        reply(ack, toSocketError(error));
      }
    });

    socket.on('seat:extend', async (payload: unknown, ack: unknown) => {
      try {
        const body = payload as { ma_chuyen?: unknown; owner_ref?: unknown } | null;
        const tripId = parseTripId(body?.ma_chuyen);
        const ownerRef = parseOwnerRef(body?.owner_ref);

        if (tripId === null || !ownerRef) {
          reply(ack, validationFailure('Dữ liệu gia hạn giữ ghế không hợp lệ'));
          return;
        }

        session.owner_ref = ownerRef;

        const result = await dependencies.seatLockService.extend({
          ma_chuyen: tripId,
          owner_ref: ownerRef,
        });

        publishSeatHeld({
          ma_chuyen: result.ma_chuyen,
          danh_sach_ghe: result.danh_sach_ghe,
          owner_ref: result.owner_ref,
          expires_at: result.expires_at,
          ttl_seconds: result.ttl_seconds,
        });

        reply(ack, { success: true, data: result });
      } catch (error) {
        reply(ack, toSocketError(error));
      }
    });

    socket.on('seat:release', async (payload: unknown, ack: unknown) => {
      try {
        const body = payload as {
          ma_chuyen?: unknown;
          danh_sach_ghe?: unknown;
          owner_ref?: unknown;
        } | null;
        const tripId = parseTripId(body?.ma_chuyen);
        const ownerRef = parseOwnerRef(body?.owner_ref);
        const seats =
          body?.danh_sach_ghe === undefined ? undefined : parseSeatList(body.danh_sach_ghe);

        if (tripId === null || !ownerRef || seats === null) {
          reply(ack, validationFailure('Dữ liệu hủy giữ ghế không hợp lệ'));
          return;
        }

        const result = await dependencies.seatLockService.release({
          ma_chuyen: tripId,
          owner_ref: ownerRef,
          danh_sach_ghe: seats,
          reason: 'RELEASED',
        });

        if (result.danh_sach_ghe.length > 0) {
          publishSeatReleased({
            ma_chuyen: tripId,
            danh_sach_ghe: result.danh_sach_ghe,
            owner_ref: ownerRef,
            reason: 'RELEASED',
          });
        }

        reply(ack, { success: true, data: result });
      } catch (error) {
        reply(ack, toSocketError(error));
      }
    });
  });

  const unsubscribeHeld = onSeatHeld((event) => emitHeld(io, event));
  const unsubscribeReleased = onSeatReleased((event) => emitReleased(io, event));
  const unsubscribeBooked = onSeatBooked((event) => emitBooked(io, event));

  return {
    io,
    async close(): Promise<void> {
      unsubscribeHeld();
      unsubscribeReleased();
      unsubscribeBooked();

      await new Promise<void>((resolve) => {
        io.close(() => {
          resolve();
        });
      });

      await Promise.allSettled([
        pubClient ? pubClient.quit() : Promise.resolve(),
        subClient ? subClient.quit() : Promise.resolve(),
      ]);
    },
  };
}
