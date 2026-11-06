import type { RoleName } from '../../common/constants';
import type { DbExecutor } from '../../db/types';

export interface PaymentActor {
  ma_nguoi_dung: string;
  ten_vai_tro: RoleName;
  ma_chi_nhanh: number | null;
}

export interface PaymentOrderRecord {
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  ma_khach_hang: string | null;
  ma_chi_nhanh_ban: number | null;
  trang_thai_don: string;
  tong_tien: string;
  thoi_gian_tao: string;
  ma_chuyen: number | null;
  danh_sach_ghe: string[];
}

export interface PaymentTransactionRecord {
  ma_thanh_toan: string;
  ma_don_ve: string;
  phuong_thuc: string;
  ma_giao_dich_vnpay: string | null;
  so_tien: string;
  trang_thai: string;
}

export interface PaymentRepositoryPort {
  findOrderById(id: string, executor?: DbExecutor): Promise<PaymentOrderRecord | null>;
  findOrderByIdentifier(code: string, executor?: DbExecutor): Promise<PaymentOrderRecord | null>;
  lockOrderByIdentifier(code: string, executor: DbExecutor): Promise<PaymentOrderRecord | null>;
  findVnpayPayment(
    orderId: string,
    executor?: DbExecutor,
  ): Promise<PaymentTransactionRecord | null>;
  markPaymentSuccess(
    input: {
      ma_thanh_toan: string;
      ma_giao_dich_vnpay: string;
      thong_tin_phan_hoi: string | null;
    },
    executor: DbExecutor,
  ): Promise<void>;
  markPaymentFailed(
    input: { ma_thanh_toan: string; thong_tin_phan_hoi: string | null },
    executor: DbExecutor,
  ): Promise<void>;
  markOrderPaid(orderId: string, executor: DbExecutor): Promise<void>;
  findOrderSeats(
    orderId: string,
    executor?: DbExecutor,
  ): Promise<{ ma_chuyen: number | null; danh_sach_ghe: string[] }>;
}

export interface VnpayCreateUrlResult {
  ma_don_ve: string;
  ma_dinh_danh_don: string;
  so_tien: string;
  payment_url: string;
  het_han_thanh_toan: string;
}

export type VnpayRspCode = '00' | '01' | '02' | '04' | '97' | '99';

export interface VnpayProcessResult {
  rsp_code: VnpayRspCode;
  message: string;
  ma_don_ve: string | null;
  ma_dinh_danh_don: string | null;
  trang_thai_don: string | null;
  ma_giao_dich_vnpay: string | null;
  thanh_cong: boolean;
  already_confirmed: boolean;
}
