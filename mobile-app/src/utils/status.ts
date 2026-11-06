import type { BookingStatus, PaymentMethod, PaymentStatus } from '../types/booking';
import type { TicketCheckinStatus } from '../types/ticket';
import type { TripStatus } from '../types/trip';

export const ORDER_STATUS_LABELS: Record<BookingStatus, string> = {
  CHO_THANH_TOAN: 'Chờ thanh toán',
  DA_THANH_TOAN: 'Đã thanh toán',
  DA_HUY: 'Đã hủy',
};

export const TICKET_STATUS_LABELS: Record<TicketCheckinStatus, string> = {
  CHUA_LEN_XE: 'Chưa lên xe',
  DA_LEN_XE: 'Đã lên xe',
};

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  SAP_CHAY: 'Sắp chạy',
  DANG_CHAY: 'Đang chạy',
  HOAN_THANH: 'Hoàn thành',
  HUY: 'Đã hủy',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  TIEN_MAT: 'Tiền mặt',
  VNPAY: 'VNPAY',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  CHO_XU_LY: 'Chờ xử lý',
  THANH_CONG: 'Thành công',
  THAT_BAI: 'Thất bại',
};
