import type { AccountStatus, PaymentMethod, PaymentStatus, RoleName } from '../../common/constants';
import type { DbExecutor } from '../../db/types';
import type { Pagination, PaginationMeta } from '../../utils/pagination';

export interface BookingActor {
  ma_nguoi_dung: string;
  ho_va_ten: string;
  ten_vai_tro: RoleName;
  ma_chi_nhanh: number | null;
  trang_thai_tai_khoan?: AccountStatus;
}

export interface BookingCustomerProfile {
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
}

export interface BookingTripInfo {
  ma_chuyen: number;
  ma_tuyen: number;
  ma_loai_xe: number;
  gia_ve_co_ban: string;
  trang_thai: string;
  thoi_gian_xuat_ben: string;
}

export interface BookingSeatInfo {
  ma_ghe: number;
  ky_hieu_ghe: string;
  loai_cho: string;
}

export interface BookingStopInfo {
  ma_diem_dung: number;
  ma_tuyen: number;
  loai_diem: string;
  thu_tu_dung: number;
}

export interface BookingTicketRecord {
  ma_ve: string;
  ma_chuyen: number;
  ma_ghe: number;
  ky_hieu_ghe: string;
  gia_ve: string;
  ma_qr_kiem_tra: string;
  trang_thai_soat_ve: string;
  trang_thai_ve: string;
}

export interface BookingPaymentRecord {
  ma_thanh_toan: string;
  phuong_thuc: PaymentMethod;
  ma_giao_dich_vnpay: string | null;
  so_tien: string;
  trang_thai: PaymentStatus;
  thoi_gian_thanh_toan: string | null;
}

export interface BookingRecord {
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
  trang_thai_don: string;
  thoi_gian_tao: string;
  chi_tiet_ve: BookingTicketRecord[];
  thanh_toan: BookingPaymentRecord[];
}

export type BookingResult = BookingRecord & {
  thoi_gian_het_han: string | null;
};

export interface ExpiredBookingOrder {
  ma_don_ve: string;
  ma_chuyen: number;
  danh_sach_ghe: string[];
}

export interface CreateOrderInput {
  ma_dinh_danh_don: string;
  ma_khach_hang: string | null;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  ma_nhan_vien_ban: string | null;
  ma_chi_nhanh_ban: number | null;
  ma_diem_don: number;
  ma_diem_tra: number;
  tong_tien: string;
  trang_thai_don: string;
}

export interface CreateTicketInput {
  ma_don_ve: string;
  ma_chuyen: number;
  ma_ghe: number;
  ky_hieu_ghe: string;
  gia_ve: string;
  ma_qr_kiem_tra: string;
  trang_thai_ve: string;
}

export interface CreatePaymentInput {
  ma_don_ve: string;
  phuong_thuc: PaymentMethod;
  so_tien: string;
  trang_thai: PaymentStatus;
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
  phuong_thuc_thanh_toan?: PaymentMethod;
  idempotency_key?: string | null;
}

export interface BookingQuoteSeat {
  ky_hieu_ghe: string;
  loai_cho: string;
  gia_ve: string;
  trang_thai: 'TRONG' | 'DANG_GIU' | 'DA_DAT';
}

export interface BookingQuoteResult {
  ma_chuyen: number;
  danh_sach_ghe: BookingQuoteSeat[];
  so_ghe_trong: number;
  tong_tien: string;
  tien_te: string;
}

export interface BookingListQuery {
  q?: unknown;
  ma_dinh_danh_don?: unknown;
  so_dien_thoai_khach?: unknown;
  ma_chuyen?: unknown;
  ma_chi_nhanh?: unknown;
  trang_thai_don?: unknown;
  tu_ngay?: unknown;
  den_ngay?: unknown;
  page?: unknown;
  limit?: unknown;
}

export interface BookingListRecord {
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  ma_khach_hang: string | null;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  ma_nhan_vien_ban: string | null;
  ma_chi_nhanh_ban: number | null;
  ten_chi_nhanh: string | null;
  ma_diem_don: number;
  ma_diem_tra: number;
  tong_tien: string;
  trang_thai_don: string;
  thoi_gian_tao: string;
  ma_chuyen: number | null;
  ma_tuyen: number | null;
  ten_tuyen: string | null;
  tinh_di: string | null;
  tinh_den: string | null;
  thoi_gian_xuat_ben: string | null;
  danh_sach_ghe: string[];
  so_ve: number;
  phuong_thuc_thanh_toan: PaymentMethod | null;
  trang_thai_thanh_toan: PaymentStatus | null;
}

export interface BookingListItem extends BookingListRecord {
  thoi_gian_het_han: string | null;
}

export interface BookingListResult {
  items: BookingListItem[];
  meta: PaginationMeta;
}

export interface BookingRepositoryPort {
  list(filters: BookingListFilters): Promise<{ items: BookingListRecord[]; total: number }>;
  findTripForBooking(
    tripId: number,
    executor?: DbExecutor,
    lock?: boolean,
  ): Promise<BookingTripInfo | null>;
  findSeatsByCodes(
    tripId: number,
    seatCodes: string[],
    executor?: DbExecutor,
  ): Promise<BookingSeatInfo[]>;
  findRouteStop(stopId: number, executor?: DbExecutor): Promise<BookingStopInfo | null>;
  findBookedSeatCodes(
    tripId: number,
    seatCodes: string[],
    executor?: DbExecutor,
  ): Promise<Set<string>>;
  createOrder(input: CreateOrderInput, executor: DbExecutor): Promise<string>;
  createTickets(inputs: CreateTicketInput[], executor: DbExecutor): Promise<void>;
  createPayment(input: CreatePaymentInput, executor: DbExecutor): Promise<string>;
  findOrderById(id: string, executor?: DbExecutor): Promise<BookingRecord | null>;
  lockOrder(id: string, executor: DbExecutor): Promise<BookingRecord | null>;
  findOrderByIdentifier(code: string): Promise<BookingRecord | null>;
  cancelOrder(id: string, executor: DbExecutor): Promise<void>;
  confirmCashPayment(id: string, executor: DbExecutor): Promise<void>;
  findExpiredOrders(cutoffUtc: string, limit: number): Promise<ExpiredBookingOrder[]>;
}

export interface BookingIdempotencyStorePort {
  get(key: string): Promise<string | null>;
  set(key: string, orderId: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface BookingListFilters {
  q: string | null;
  ma_dinh_danh_don: string | null;
  so_dien_thoai_khach: string | null;
  ma_chuyen: number | null;
  ma_chi_nhanh: number | null;
  include_unassigned_branch: boolean;
  trang_thai_don: string | null;
  start_utc: string | null;
  end_utc: string | null;
  pagination: Pagination;
}
