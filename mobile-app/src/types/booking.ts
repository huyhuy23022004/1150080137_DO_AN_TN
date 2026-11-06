export type BookingStatus = 'CHO_THANH_TOAN' | 'DA_THANH_TOAN' | 'DA_HUY';
export type PaymentMethod = 'TIEN_MAT' | 'VNPAY';
export type PaymentStatus = 'CHO_XU_LY' | 'THANH_CONG' | 'THAT_BAI';

export interface BookingTicket {
  ma_ve: string;
  ma_chuyen: number;
  ma_ghe: number;
  ky_hieu_ghe: string;
  gia_ve: string;
  ma_qr_kiem_tra: string;
  trang_thai_soat_ve: string;
  trang_thai_ve: string;
}

export interface BookingPayment {
  ma_thanh_toan: string;
  phuong_thuc: PaymentMethod;
  ma_giao_dich_vnpay: string | null;
  so_tien: string;
  trang_thai: PaymentStatus;
  thoi_gian_thanh_toan: string | null;
}

export interface BookingOrder {
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  ma_chuyen: number | null;
  ma_khach_hang: string | null;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  ma_nhan_vien_ban: string | null;
  ma_chi_nhanh_ban: number | null;
  ma_diem_don: number;
  ma_diem_tra: number;
  tong_tien: string;
  trang_thai_don: BookingStatus;
  thoi_gian_tao: string;
  chi_tiet_ve: BookingTicket[];
  thanh_toan: BookingPayment[];
  thoi_gian_het_han: string | null;
  owner_ref?: string;
}

export interface BookingSeatQuote {
  ky_hieu_ghe: string;
  loai_cho: string;
  gia_ve: string;
  trang_thai: 'TRONG' | 'DANG_GIU' | 'DA_DAT';
}

export interface BookingQuote {
  ma_chuyen: number;
  danh_sach_ghe: BookingSeatQuote[];
  so_ghe_trong: number;
  tong_tien: string;
  tien_te: string;
}

export interface CreateBookingInput {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  owner_ref: string;
  ma_diem_don: number;
  ma_diem_tra: number;
  ho_ten_khach?: string;
  so_dien_thoai_khach?: string;
  email_khach?: string;
  phuong_thuc_thanh_toan: PaymentMethod;
  idempotency_key?: string;
}

export interface CreateBookingResult {
  don_dat_ve: BookingOrder;
  payment_url?: string;
}

export interface VnpayPaymentUrl {
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  so_tien: string;
  payment_url: string;
  het_han_thanh_toan: string;
}
