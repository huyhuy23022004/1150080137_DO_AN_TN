import type { ApiEnvelope } from '@/types/api';
import type {
  CounterQuote,
  CounterSeatMap,
  CreateCounterBookingInput,
  CreateCounterBookingResult,
} from '@/types/counter';
import type { TripDetail } from '@/types/trip';
import { http } from '../http';

export const counterApi = {
  async getSeatMap(tripId: number): Promise<CounterSeatMap> {
    const response = await http.get<ApiEnvelope<{ so_do_ghe: CounterSeatMap }>>(
      `/trips/${tripId}/seat-map`,
    );
    return response.data.data.so_do_ghe;
  },

  async getTrip(tripId: number): Promise<TripDetail> {
    const response = await http.get<ApiEnvelope<{ chuyen_xe: TripDetail }>>(`/trips/${tripId}`);
    return response.data.data.chuyen_xe;
  },

  async quote(tripId: number, seats: string[]): Promise<CounterQuote> {
    const response = await http.post<ApiEnvelope<{ bao_gia: CounterQuote }>>('/bookings/quote', {
      ma_chuyen: tripId,
      danh_sach_ghe: seats,
    });
    return response.data.data.bao_gia;
  },

  async create(
    input: CreateCounterBookingInput,
    idempotencyKey: string,
  ): Promise<CreateCounterBookingResult> {
    const response = await http.post<ApiEnvelope<CreateCounterBookingResult>>('/bookings', input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return response.data.data;
  },
};
