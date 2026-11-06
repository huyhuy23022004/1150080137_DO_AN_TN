import type { ApiEnvelope } from '../../types/api';
import type { VnpayPaymentUrl } from '../../types/booking';
import { apiClient } from '../client';

export const paymentsApi = {
  async createVnpayUrl(bookingId: string): Promise<VnpayPaymentUrl> {
    const response = await apiClient.post<ApiEnvelope<{ thanh_toan: VnpayPaymentUrl }>>(
      '/payments/vnpay/create-url',
      { ma_don_ve: bookingId },
    );
    return response.data.data.thanh_toan;
  },
};
