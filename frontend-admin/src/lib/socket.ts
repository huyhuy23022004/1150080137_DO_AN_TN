import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/api/token';
import type {
  CounterSeatMap,
  HeldSeatResult,
  SeatBookedEvent,
  SeatHeldEvent,
  SeatReleasedEvent,
} from '@/types/counter';

interface SocketAck<T> {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
}

let socket: Socket | null = null;

function socketUrl(): string {
  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
}

function socketPath(): string {
  return import.meta.env.VITE_SOCKET_PATH || '/socket.io';
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(socketUrl(), {
      path: socketPath(),
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      auth: () => ({ token: getAccessToken() ?? '' }),
    });
  }

  return socket;
}

export function connectSocket(): Socket {
  const client = getSocket();
  client.auth = { token: getAccessToken() ?? '' };

  if (!client.connected) {
    client.connect();
  }

  return client;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

function emitWithAck<T>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const client = getSocket();

    client
      .timeout(8_000)
      .emit(event, payload, (timeoutError: Error | null, response: SocketAck<T>) => {
        if (timeoutError) {
          reject(new Error('Không thể kết nối tới máy chủ thời gian thực'));
          return;
        }

        if (!response?.success || response.data === undefined) {
          reject(new Error(response?.message || 'Thao tác giữ ghế thất bại'));
          return;
        }

        resolve(response.data);
      });
  });
}

export function joinTrip(tripId: number): Promise<CounterSeatMap> {
  return emitWithAck<{ so_do_ghe: CounterSeatMap }>('trip:join', { ma_chuyen: tripId }).then(
    (data) => data.so_do_ghe,
  );
}

export function leaveTrip(tripId: number): Promise<void> {
  return emitWithAck<unknown>('trip:leave', { ma_chuyen: tripId }).then(() => undefined);
}

export function holdSeats(
  tripId: number,
  seats: string[],
  ownerRef: string,
): Promise<HeldSeatResult> {
  return emitWithAck<HeldSeatResult>('seat:hold', {
    ma_chuyen: tripId,
    danh_sach_ghe: seats,
    owner_ref: ownerRef,
  });
}

export function extendSeats(tripId: number, ownerRef: string): Promise<HeldSeatResult> {
  return emitWithAck<HeldSeatResult>('seat:extend', {
    ma_chuyen: tripId,
    owner_ref: ownerRef,
  });
}

export function releaseSeats(tripId: number, seats: string[], ownerRef: string): Promise<void> {
  return emitWithAck<unknown>('seat:release', {
    ma_chuyen: tripId,
    danh_sach_ghe: seats,
    owner_ref: ownerRef,
  }).then(() => undefined);
}

export type { SeatBookedEvent, SeatHeldEvent, SeatReleasedEvent };
