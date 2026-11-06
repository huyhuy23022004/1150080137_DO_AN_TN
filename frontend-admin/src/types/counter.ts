import type { PaymentMethod } from './booking';

export type SeatAvailability = 'TRONG' | 'DANG_GIU' | 'DA_DAT';

export interface CounterSeat {
  ma_ghe: number;
  ky_hieu_ghe: string;
  tang: number;
  hang: number;
  cot: number;
  loai_cho: 'THUONG' | 'VIP';
  trang_thai: SeatAvailability;
}

export interface CounterSeatMap {
  ma_chuyen: number;
  ma_xe: number;
  bien_so_xe: string;
  ma_loai_xe: number;
  ten_loai_xe: string;
  tong_so_ghe: number;
  so_ghe_trong: number;
  ghe: CounterSeat[];
}

export interface CounterQuoteSeat {
  ky_hieu_ghe: string;
  loai_cho: string;
  gia_ve: string;
  trang_thai: SeatAvailability;
}

export interface CounterQuote {
  ma_chuyen: number;
  danh_sach_ghe: CounterQuoteSeat[];
  so_ghe_trong: number;
  tong_tien: string;
  tien_te: string;
}

export interface CreateCounterBookingInput {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  owner_ref: string;
  ma_diem_don: number;
  ma_diem_tra: number;
  ho_ten_khach?: string;
  so_dien_thoai_khach?: string;
  email_khach?: string;
  phuong_thuc_thanh_toan: PaymentMethod;
}

export interface CreatedCounterBooking {
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  tong_tien: string;
  trang_thai_don: string;
  thoi_gian_het_han: string | null;
}

export interface CreateCounterBookingResult {
  don_dat_ve: CreatedCounterBooking;
  payment_url?: string;
}

export interface HeldSeatResult {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  owner_ref: string;
  expires_at: string;
  ttl_seconds: number;
}

export interface SeatHeldEvent {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  expires_at: string;
  ttl_seconds: number;
}

export interface SeatReleasedEvent {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  reason: string;
}

export interface SeatBookedEvent {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  ma_don_ve: string;
  trang_thai_don: string;
}
