import { io, type Socket } from 'socket.io-client';
import { env } from '../config/env';
import type { SeatMap } from '../types/trip';
import { tripSocketTracker } from './socket-tracker';

export interface SocketAck<T = unknown> {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
}

export interface SeatHoldResult {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  owner_ref: string;
  expires_at: string;
  ttl_seconds: number;
}

export interface SeatHeldEvent {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  expires_at: string;
  ttl_seconds: number;
}

export interface SeatReleasedEvent {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  reason?: string;
}

export interface SeatBookedEvent {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  ma_don_ve?: number;
  trang_thai_don?: string;
}

interface ServerToClientEvents {
  'seat:held': (payload: SeatHeldEvent) => void;
  'seat:released': (payload: SeatReleasedEvent) => void;
  'seat:booked': (payload: SeatBookedEvent) => void;
  'trip:update': (payload: unknown) => void;
}

interface ClientToServerEvents {
  'trip:join': (
    payload: { ma_chuyen: number },
    ack: (response: SocketAck<{ so_do_ghe: SeatMap }>) => void,
  ) => void;
  'trip:leave': (payload: { ma_chuyen: number }, ack: (response: SocketAck) => void) => void;
  'seat:hold': (
    payload: { ma_chuyen: number; danh_sach_ghe: string[]; owner_ref: string },
    ack: (response: SocketAck<SeatHoldResult>) => void,
  ) => void;
  'seat:extend': (
    payload: { ma_chuyen: number; owner_ref: string },
    ack: (response: SocketAck<SeatHoldResult>) => void,
  ) => void;
  'seat:release': (
    payload: { ma_chuyen: number; danh_sach_ghe?: string[]; owner_ref: string },
    ack: (response: SocketAck<{ danh_sach_ghe: string[] }>) => void,
  ) => void;
}

export type TripSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const ACK_TIMEOUT_MS = 8_000;

export function createTripSocket(token: string | null): TripSocket {
  const socket = io(env.socketUrl, {
    path: env.socketPath,
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1_000,
    auth: token ? { token } : {},
  });

  tripSocketTracker.track(socket);
  return socket;
}

export function untrackTripSocket(socket: TripSocket): void {
  tripSocketTracker.untrack(socket);
}

export function reconnectTrackedTripSockets(): void {
  tripSocketTracker.reconnectAll();
}

export function connectTripSocket(socket: TripSocket): void {
  if (!socket.connected) {
    socket.connect();
  }
}

export function waitForSocketConnection(socket: TripSocket): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Không thể kết nối realtime. Vui lòng thử lại.'));
    }, ACK_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
    };

    const onConnect = () => {
      cleanup();
      resolve();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(new Error(error.message || 'Không thể kết nối realtime.'));
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
    socket.connect();
  });
}

function request<T>(send: (ack: (response: SocketAck<T>) => void) => void): Promise<SocketAck<T>> {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({
          success: false,
          code: 'SOCKET_TIMEOUT',
          message: 'Máy chủ không phản hồi. Vui lòng thử lại.',
        });
      }
    }, ACK_TIMEOUT_MS);

    send((response) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve(response);
    });
  });
}

export function joinTrip(
  socket: TripSocket,
  tripId: number,
): Promise<SocketAck<{ so_do_ghe: SeatMap }>> {
  return request((ack) => socket.emit('trip:join', { ma_chuyen: tripId }, ack));
}

export function leaveTrip(socket: TripSocket, tripId: number): Promise<SocketAck> {
  return request((ack) => socket.emit('trip:leave', { ma_chuyen: tripId }, ack));
}

export function holdSeats(
  socket: TripSocket,
  tripId: number,
  seatCodes: string[],
  ownerRef: string,
): Promise<SocketAck<SeatHoldResult>> {
  return request((ack) =>
    socket.emit(
      'seat:hold',
      { ma_chuyen: tripId, danh_sach_ghe: seatCodes, owner_ref: ownerRef },
      ack,
    ),
  );
}

export function extendSeatHold(
  socket: TripSocket,
  tripId: number,
  ownerRef: string,
): Promise<SocketAck<SeatHoldResult>> {
  return request((ack) =>
    socket.emit('seat:extend', { ma_chuyen: tripId, owner_ref: ownerRef }, ack),
  );
}

export function releaseSeats(
  socket: TripSocket,
  tripId: number,
  ownerRef: string,
  seatCodes?: string[],
): Promise<SocketAck<{ danh_sach_ghe: string[] }>> {
  return request((ack) =>
    socket.emit(
      'seat:release',
      {
        ma_chuyen: tripId,
        owner_ref: ownerRef,
        ...(seatCodes && seatCodes.length > 0 ? { danh_sach_ghe: seatCodes } : {}),
      },
      ack,
    ),
  );
}
