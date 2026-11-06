import type { BookingStatus, PaymentStatus } from './booking';
import type { TripStatus } from './trip';

export type TicketCheckinStatus = 'CHUA_LEN_XE' | 'DA_LEN_XE';

export interface Ticket {
  ma_ve: string;
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  ma_chuyen: number;
  ma_ghe: number;
  ky_hieu_ghe: string;
  gia_ve: string;
  ma_qr_kiem_tra: string;
  trang_thai_soat_ve: TicketCheckinStatus;
  thoi_gian_soat_ve: string | null;
  tai_xe_soat_ve: string | null;
  trang_thai_ve: string;
  ma_khach_hang: string | null;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  ma_chi_nhanh_ban: number | null;
  trang_thai_don: BookingStatus;
  thoi_gian_tao: string;
  thoi_gian_xuat_ben: string;
  trang_thai_chuyen: TripStatus;
  ma_tai_xe: string;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  bien_so_xe: string;
  ten_tai_xe: string;
}

export interface TicketQr {
  ma_ve: string;
  ma_qr_kiem_tra: string;
  dinh_dang: string;
  qr_data_url: string;
}

export interface CheckinResult {
  already_checked_in: boolean;
  ve: Ticket;
}

export interface Passenger {
  ma_ve: string;
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  ky_hieu_ghe: string;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  trang_thai_soat_ve: TicketCheckinStatus;
  thoi_gian_soat_ve: string | null;
}

export interface TripPassengers {
  ma_chuyen: number;
  thoi_gian_xuat_ben: string;
  tong_so_hanh_khach: number;
  da_len_xe: number;
  chua_len_xe: number;
  danh_sach: Passenger[];
}

export interface TicketOrderGroup {
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  trang_thai_don: BookingStatus;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  thoi_gian_xuat_ben: string;
  ma_chuyen: number;
  tickets: Ticket[];
  tong_tien: number;
  trang_thai_thanh_toan: PaymentStatus | null;
}
