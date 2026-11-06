import type { RoleName } from '../../common/constants';
import type { DbExecutor } from '../../db/types';
import type { Pagination } from '../../utils/pagination';

export interface TicketActor {
  ma_nguoi_dung: string;
  ho_va_ten: string;
  ten_vai_tro: RoleName;
  ma_chi_nhanh: number | null;
}

export interface TicketRecord {
  ma_ve: string;
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  ma_chuyen: number;
  ma_ghe: number;
  ky_hieu_ghe: string;
  gia_ve: string;
  ma_qr_kiem_tra: string;
  trang_thai_soat_ve: string;
  thoi_gian_soat_ve: string | null;
  tai_xe_soat_ve: string | null;
  trang_thai_ve: string;
  ma_khach_hang: string | null;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  ma_chi_nhanh_ban: number | null;
  trang_thai_don: string;
  thoi_gian_tao: string;
  thoi_gian_xuat_ben: string;
  trang_thai_chuyen: string;
  ma_tai_xe: string;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  bien_so_xe: string;
  ten_tai_xe: string;
}

export interface PassengerRecord {
  ma_ve: string;
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  ky_hieu_ghe: string;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  trang_thai_soat_ve: string;
  thoi_gian_soat_ve: string | null;
}

export interface TicketTripAssignment {
  ma_chuyen: number;
  ma_tai_xe: string;
  thoi_gian_xuat_ben: string;
  trang_thai: string;
  ma_chi_nhanh_tai_xe: number | null;
}

export interface TicketListFilters {
  trang_thai_soat_ve: string | null;
  trang_thai_don: string | null;
  pagination: Pagination;
}

export interface TicketRepositoryPort {
  listByCustomer(
    customerId: string,
    filters: TicketListFilters,
  ): Promise<{ items: TicketRecord[]; total: number }>;
  findById(ticketId: string, executor?: DbExecutor): Promise<TicketRecord | null>;
  findByToken(token: string, executor?: DbExecutor, lock?: boolean): Promise<TicketRecord | null>;
  updateCheckin(ticketId: string, driverId: string, executor: DbExecutor): Promise<boolean>;
  findTripAssignment(tripId: number, executor?: DbExecutor): Promise<TicketTripAssignment | null>;
  listPassengersByTrip(tripId: number, executor?: DbExecutor): Promise<PassengerRecord[]>;
}

export interface CheckinResult {
  already_checked_in: boolean;
  ve: TicketRecord;
}

export interface TripPassengersResult {
  ma_chuyen: number;
  thoi_gian_xuat_ben: string;
  tong_so_hanh_khach: number;
  da_len_xe: number;
  chua_len_xe: number;
  danh_sach: PassengerRecord[];
}
