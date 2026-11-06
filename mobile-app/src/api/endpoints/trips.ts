import type { ApiEnvelope } from '../../types/api';
import type {
  SeatMap,
  Trip,
  TripDetail,
  TripSearchParams,
  TripSearchResult,
} from '../../types/trip';
import { apiClient } from '../client';

function cleanParams(params: TripSearchParams): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  if (params.tinh_di?.trim()) {
    result.tinh_di = params.tinh_di.trim();
  }

  if (params.tinh_den?.trim()) {
    result.tinh_den = params.tinh_den.trim();
  }

  if (params.ma_tuyen !== undefined) {
    result.ma_tuyen = params.ma_tuyen;
  }

  if (params.ngay) {
    result.ngay = params.ngay;
  }

  if (params.page !== undefined) {
    result.page = params.page;
  }

  result.limit = params.limit ?? 20;
  return result;
}

export const tripsApi = {
  async search(params: TripSearchParams): Promise<TripSearchResult> {
    const response = await apiClient.get<ApiEnvelope<Trip[]>>('/trips', {
      params: cleanParams(params),
    });
    const data = response.data.data;

    return {
      items: data,
      meta: response.data.meta ?? {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        total: data.length,
        total_pages: 1,
      },
    };
  },

  async getDetail(tripId: number): Promise<TripDetail> {
    const response = await apiClient.get<ApiEnvelope<{ chuyen_xe: TripDetail }>>(
      `/trips/${tripId}`,
    );
    return response.data.data.chuyen_xe;
  },

  async getSeatMap(tripId: number): Promise<SeatMap> {
    const response = await apiClient.get<ApiEnvelope<{ so_do_ghe: SeatMap }>>(
      `/trips/${tripId}/seat-map`,
    );
    return response.data.data.so_do_ghe;
  },
};
