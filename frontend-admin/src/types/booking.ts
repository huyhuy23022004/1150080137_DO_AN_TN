import type { PaginationMeta } from './api';

export type OrderStatus = 'CHO_THANH_TOAN' | 'DA_THANH_TOAN' | 'DA_HUY';
export type PaymentMethod = 'TIEN_MAT' | 'VNPAY';
export type PaymentStatus = 'CHO_XU_LY' | 'THANH_CONG' | 'THAT_BAI';

export interface BookingListItem {
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  ma_khach_hang: string | null;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  ma_nhan_vien_ban: string | null;
  ma_chi_nhanh_ban: number | null;
  ten_chi_nhanh: string | null;
  ma_chuyen: number | null;
  ma_tuyen: number | null;
  ten_tuyen: string | null;
  tinh_di: string | null;
  tinh_den: string | null;
  thoi_gian_xuat_ben: string | null;
  danh_sach_ghe: string[];
  so_ve: number;
  tong_tien: string;
  trang_thai_don: OrderStatus;
  phuong_thuc_thanh_toan: PaymentMethod | null;
  trang_thai_thanh_toan: PaymentStatus | null;
  thoi_gian_tao: string;
  thoi_gian_het_han: string | null;
}

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

export interface BookingDetail {
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  ma_chuyen: number;
  ma_khach_hang: string | null;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  ma_nhan_vien_ban: string | null;
  ma_chi_nhanh_ban: number | null;
  ma_diem_don: number;
  ma_diem_tra: number;
  tong_tien: string;
  trang_thai_don: OrderStatus;
  thoi_gian_tao: string;
  chi_tiet_ve: BookingTicket[];
  thanh_toan: BookingPayment[];
  thoi_gian_het_han: string | null;
}

export interface BookingListFilters {
  q?: string;
  ma_dinh_danh_don?: string;
  so_dien_thoai_khach?: string;
  ma_chuyen?: number;
  ma_chi_nhanh?: number;
  trang_thai_don?: OrderStatus;
  tu_ngay?: string;
  den_ngay?: string;
  page: number;
  limit: number;
}

export interface BookingListResult {
  items: BookingListItem[];
  meta: PaginationMeta;
}
