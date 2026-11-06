import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { counterApi } from '@/api/endpoints/counter';
import { tripsApi } from '@/api/endpoints/trips';
import { queryKeys } from '@/api/query-keys';
import { connectSocket, joinTrip, leaveTrip } from '@/lib/socket';
import type {
  CounterQuote,
  CounterSeatMap,
  CreateCounterBookingInput,
  CreateCounterBookingResult,
  SeatBookedEvent,
  SeatHeldEvent,
  SeatReleasedEvent,
} from '@/types/counter';
import type { Trip } from '@/types/trip';

interface CounterTripFilters {
  ma_tuyen?: number;
  ngay?: string;
}

interface RealtimeHandlers {
  onSeatsReleased?: (seats: string[]) => void;
  onSeatsBooked?: (event: SeatBookedEvent) => void;
}

export function useCounterTrips(filters: CounterTripFilters) {
  return useQuery({
    queryKey: queryKeys.counter.trips(filters),
    queryFn: async (): Promise<Trip[]> => {
      const result = await tripsApi.list({
        trang_thai: 'SAP_CHAY',
        ...(filters.ma_tuyen ? { ma_tuyen: filters.ma_tuyen } : {}),
        ...(filters.ngay ? { tu_ngay: filters.ngay, den_ngay: filters.ngay } : {}),
        page: 1,
        limit: 100,
      });
      return result.items;
    },
    staleTime: 30_000,
  });
}

export function useCounterTripDetail(tripId: number | null) {
  return useQuery({
    queryKey: queryKeys.trips.detail(tripId ?? 0),
    queryFn: () => counterApi.getTrip(tripId as number),
    enabled: Boolean(tripId),
    staleTime: 60_000,
  });
}

export function useCounterSeatMap(tripId: number | null, handlers: RealtimeHandlers = {}) {
  const [liveMap, setLiveMap] = useState<CounterSeatMap | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const query = useQuery({
    queryKey: queryKeys.counter.seatMap(tripId ?? 0),
    queryFn: () => counterApi.getSeatMap(tripId as number),
    enabled: Boolean(tripId),
  });

  useEffect(() => {
    setLiveMap(query.data ?? null);
  }, [query.data]);

  useEffect(() => {
    if (!tripId) {
      setLiveMap(null);
      return undefined;
    }

    setLiveMap(null);
    const client = connectSocket();
    let disposed = false;

    function applyStatus(seats: string[], status: 'TRONG' | 'DANG_GIU' | 'DA_DAT'): void {
      const codes = new Set(seats);
      setLiveMap((previous) => {
        if (!previous || previous.ma_chuyen !== tripId) {
          return previous;
        }

        const ghe = previous.ghe.map((seat) =>
          codes.has(seat.ky_hieu_ghe) ? { ...seat, trang_thai: status } : seat,
        );

        return {
          ...previous,
          ghe,
          so_ghe_trong: ghe.filter((seat) => seat.trang_thai === 'TRONG').length,
        };
      });
    }

    function handleHeld(payload: SeatHeldEvent): void {
      if (payload.ma_chuyen === tripId) {
        applyStatus(payload.danh_sach_ghe, 'DANG_GIU');
      }
    }

    function handleReleased(payload: SeatReleasedEvent): void {
      if (payload.ma_chuyen !== tripId) {
        return;
      }

      applyStatus(payload.danh_sach_ghe, 'TRONG');
      handlersRef.current.onSeatsReleased?.(payload.danh_sach_ghe);
    }

    function handleBooked(payload: SeatBookedEvent): void {
      if (payload.ma_chuyen !== tripId) {
        return;
      }

      applyStatus(payload.danh_sach_ghe, 'DA_DAT');
      handlersRef.current.onSeatsBooked?.(payload);
    }

    function handleConnect(): void {
      setConnected(true);
      setConnectionError(null);
      joinTrip(tripId as number)
        .then((map) => {
          if (!disposed) {
            setLiveMap(map);
          }
        })
        .catch((error: unknown) => {
          if (!disposed) {
            setConnectionError(
              error instanceof Error ? error.message : 'Không thể tham gia chuyến',
            );
          }
        });
    }

    function handleDisconnect(): void {
      setConnected(false);
    }

    function handleConnectError(error: Error): void {
      setConnected(false);
      setConnectionError(error.message);
    }

    client.on('connect', handleConnect);
    client.on('disconnect', handleDisconnect);
    client.on('connect_error', handleConnectError);
    client.on('seat:held', handleHeld);
    client.on('seat:released', handleReleased);
    client.on('seat:booked', handleBooked);

    if (client.connected) {
      handleConnect();
    }

    return () => {
      disposed = true;
      client.off('connect', handleConnect);
      client.off('disconnect', handleDisconnect);
      client.off('connect_error', handleConnectError);
      client.off('seat:held', handleHeld);
      client.off('seat:released', handleReleased);
      client.off('seat:booked', handleBooked);

      if (client.connected) {
        leaveTrip(tripId).catch(() => undefined);
      }
    };
  }, [tripId]);

  return {
    ...query,
    data: liveMap ?? query.data,
    connected,
    connectionError,
  };
}

export function useCounterQuote(tripId: number | null, seats: string[]) {
  return useQuery<CounterQuote>({
    queryKey: queryKeys.counter.quote(tripId ?? 0, seats),
    queryFn: () => counterApi.quote(tripId as number, seats),
    enabled: Boolean(tripId) && seats.length > 0,
    staleTime: 10_000,
  });
}

export function useCreateCounterBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateCounterBookingInput;
      idempotencyKey: string;
    }): Promise<CreateCounterBookingResult> => counterApi.create(input, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.counter.all });
    },
  });
}
