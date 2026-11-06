import type { ApiEnvelope } from '../../types/api';
import type { CheckinResult, Ticket, TicketQr, TripPassengers } from '../../types/ticket';
import { apiClient } from '../client';

export interface TicketListParams {
  trang_thai_soat_ve?: 'CHUA_LEN_XE' | 'DA_LEN_XE';
  trang_thai_don?: 'CHO_THANH_TOAN' | 'DA_THANH_TOAN' | 'DA_HUY';
  page?: number;
  limit?: number;
}

export const ticketsApi = {
  async listMine(params: TicketListParams = {}): Promise<{
    items: Ticket[];
    meta: { page: number; limit: number; total: number; total_pages: number };
  }> {
    const response = await apiClient.get<ApiEnvelope<Ticket[]>>('/tickets/my', {
      params: {
        ...params,
        limit: params.limit ?? 100,
      },
    });

    return {
      items: response.data.data,
      meta: response.data.meta ?? {
        page: params.page ?? 1,
        limit: params.limit ?? 100,
        total: response.data.data.length,
        total_pages: 1,
      },
    };
  },

  async getById(ticketId: string): Promise<Ticket> {
    const response = await apiClient.get<ApiEnvelope<{ ve: Ticket }>>(`/tickets/${ticketId}`);
    return response.data.data.ve;
  },

  async getQr(ticketId: string): Promise<TicketQr> {
    const response = await apiClient.get<ApiEnvelope<TicketQr>>(`/tickets/${ticketId}/qr`);
    return response.data.data;
  },

  async listPassengers(tripId: number): Promise<TripPassengers> {
    const response = await apiClient.get<ApiEnvelope<{ chuyen_xe: TripPassengers }>>(
      `/tickets/trips/${tripId}/passengers`,
    );
    return response.data.data.chuyen_xe;
  },

  async checkIn(token: string): Promise<CheckinResult> {
    const response = await apiClient.post<ApiEnvelope<CheckinResult>>('/tickets/check-in', {
      ma_qr: token,
    });
    return response.data.data;
  },
};
