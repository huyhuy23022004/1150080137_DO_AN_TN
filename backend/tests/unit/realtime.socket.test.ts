import http from 'node:http';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../src/config/env';
import { createRealtimeServer, type RealtimeServer } from '../../src/realtime/socket';
import type { TokenService } from '../../src/modules/auth/token.service';
import type { SeatLockService } from '../../src/modules/seat-locks/seat-locks.service';
import type { TripService } from '../../src/modules/trips/trips.service';

interface AckResponse {
  success: boolean;
  data?: unknown;
  code?: string;
  message?: string;
}

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

function once<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, (payload: T) => resolve(payload));
  });
}

function connect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error) => reject(error));
  });
}

function emitWithAck(socket: ClientSocket, event: string, payload: unknown): Promise<AckResponse> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response: AckResponse) => resolve(response));
  });
}

async function startServer(): Promise<{ realtime: RealtimeServer; url: string }> {
  const httpServer = http.createServer();
  const seatLockService = {
    hold: vi.fn(
      async (request: { ma_chuyen: number; danh_sach_ghe: string[]; owner_ref: string }) => ({
        ma_chuyen: request.ma_chuyen,
        danh_sach_ghe: request.danh_sach_ghe,
        owner_ref: request.owner_ref,
        expires_at: '2026-10-21T08:08:00.000Z',
        ttl_seconds: 480,
      }),
    ),
    extend: vi.fn(),
    release: vi.fn(),
  } as unknown as SeatLockService;

  const tripService = {
    getSeatMap: vi.fn(async () => ({
      ma_chuyen: 10,
      ma_xe: 1,
      bien_so_xe: '51B-123.45',
      ma_loai_xe: 1,
      ten_loai_xe: 'Limousine 34',
      tong_so_ghe: 2,
      so_ghe_trong: 2,
      ghe: [
        {
          ma_ghe: 1,
          ky_hieu_ghe: 'A1',
          tang: 1,
          hang: 1,
          cot: 1,
          loai_cho: 'THUONG',
          trang_thai: 'TRONG',
        },
        {
          ma_ghe: 2,
          ky_hieu_ghe: 'A2',
          tang: 1,
          hang: 1,
          cot: 2,
          loai_cho: 'THUONG',
          trang_thai: 'TRONG',
        },
      ],
    })),
  } as unknown as TripService;

  const realtime = await createRealtimeServer(httpServer, {
    tokenService: { verifyAccessToken: vi.fn() } as unknown as TokenService,
    seatLockService,
    tripService,
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not resolve test server port');
  }

  cleanups.push(async () => {
    await realtime.close();
  });

  return { realtime, url: `http://127.0.0.1:${address.port}` };
}

function connectClient(url: string): ClientSocket {
  const socket = createClient(url, {
    path: config.socket.path,
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  cleanups.push(() => {
    socket.close();
  });
  return socket;
}

describe('Realtime Socket.IO', () => {
  it('ghế đang giữ được broadcast tới mọi client trong room', async () => {
    const { url } = await startServer();
    const clientA = connectClient(url);
    const clientB = connectClient(url);
    await Promise.all([connect(clientA), connect(clientB)]);

    const joinA = await emitWithAck(clientA, 'trip:join', { ma_chuyen: 10 });
    const joinB = await emitWithAck(clientB, 'trip:join', { ma_chuyen: 10 });

    expect(joinA.success).toBe(true);
    expect(joinB.success).toBe(true);
    expect(joinA.data).toMatchObject({
      so_do_ghe: { ma_chuyen: 10, tong_so_ghe: 2 },
    });

    const eventA = once<Record<string, unknown>>(clientA, 'seat:held');
    const eventB = once<Record<string, unknown>>(clientB, 'seat:held');

    const ack = await emitWithAck(clientA, 'seat:hold', {
      ma_chuyen: 10,
      danh_sach_ghe: ['A1'],
      owner_ref: 'hold_client_12345',
    });

    expect(ack.success).toBe(true);

    const [payloadA, payloadB] = await Promise.all([eventA, eventB]);
    expect(payloadA).toEqual({
      ma_chuyen: 10,
      danh_sach_ghe: ['A1'],
      expires_at: '2026-10-21T08:08:00.000Z',
      ttl_seconds: 480,
    });
    expect(payloadB).toEqual(payloadA);
    expect(payloadA).not.toHaveProperty('owner_ref');
  });

  it('trả lỗi validation qua ack khi payload giữ ghế sai', async () => {
    const { url } = await startServer();
    const client = connectClient(url);
    await connect(client);

    const ack = await emitWithAck(client, 'seat:hold', {
      ma_chuyen: 10,
      danh_sach_ghe: [],
      owner_ref: 'short',
    });

    expect(ack.success).toBe(false);
    expect(ack.code).toBe('VALIDATION_ERROR');
  });
});
