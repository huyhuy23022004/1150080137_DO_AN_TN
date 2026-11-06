import type { ApiEnvelope } from '../../types/api';
import type {
  BookingOrder,
  BookingQuote,
  CreateBookingInput,
  CreateBookingResult,
} from '../../types/booking';
import { apiClient } from '../client';

export const bookingsApi = {
  async quote(tripId: number, seatCodes: string[]): Promise<BookingQuote> {
    const response = await apiClient.post<ApiEnvelope<{ bao_gia: BookingQuote }>>(
      '/bookings/quote',
      {
        ma_chuyen: tripId,
        danh_sach_ghe: seatCodes,
      },
    );
    return response.data.data.bao_gia;
  },

  async create(input: CreateBookingInput, idempotencyKey: string): Promise<CreateBookingResult> {
    const response = await apiClient.post<ApiEnvelope<CreateBookingResult>>(
      '/bookings',
      {
        ...input,
        idempotency_key: input.idempotency_key ?? idempotencyKey,
      },
      {
        headers: { 'Idempotency-Key': idempotencyKey },
      },
    );
    return response.data.data;
  },

  async getById(bookingId: string): Promise<BookingOrder> {
    const response = await apiClient.get<ApiEnvelope<{ don_dat_ve: BookingOrder }>>(
      `/bookings/${bookingId}`,
    );
    return response.data.data.don_dat_ve;
  },

  async cancel(bookingId: string): Promise<BookingOrder> {
    const response = await apiClient.post<ApiEnvelope<{ don_dat_ve: BookingOrder }>>(
      `/bookings/${bookingId}/cancel`,
    );
    return response.data.data.don_dat_ve;
  },
};
