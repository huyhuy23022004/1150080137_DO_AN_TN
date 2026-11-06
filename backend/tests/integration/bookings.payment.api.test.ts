import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import type { AuthUserRecord } from '../../src/modules/auth/auth.types';
import type { BookingService } from '../../src/modules/bookings/bookings.service';
import type { BookingResult } from '../../src/modules/bookings/bookings.types';
import type { PaymentService } from '../../src/modules/payments/payments.service';
import type { VnpayCreateUrlResult } from '../../src/modules/payments/payments.types';
import { buildTestAuth, type TestAuthContext } from '../helpers/build-test-auth';

const CUSTOMER: AuthUserRecord = {
  ma_nguoi_dung: '7',
  ma_vai_tro: 1,
  ma_chi_nhanh: null,
  ho_va_ten: 'Nguyễn Văn A',
  so_dien_thoai: '0901234567',
  email: 'a@example.com',
  mat_khau_ma_hoa: 'hash',
  trang_thai_tai_khoan: 'HOAT_DONG',
  thoi_gian_tao: '2026-01-01T00:00:00.000Z',
  ten_vai_tro: 'KHACH_HANG',
};

const BOOKING: BookingResult = {
  ma_don_ve: '100',
  ma_dinh_danh_don: 'FUTA261021000001',
  ma_chuyen: 10,
  ma_khach_hang: '7',
  ho_ten_khach: 'Lê Văn Khách',
  so_dien_thoai_khach: '0909999999',
  email_khach: null,
  ma_nhan_vien_ban: null,
  ma_chi_nhanh_ban: null,
  ma_diem_don: 1,
  ma_diem_tra: 2,
  tong_tien: '640000.00',
  trang_thai_don: 'CHO_THANH_TOAN',
  thoi_gian_tao: '2026-10-21T08:00:00.000Z',
  thoi_gian_het_han: '2026-10-21T08:15:00.000Z',
  chi_tiet_ve: [],
  thanh_toan: [],
};

const PAYMENT: VnpayCreateUrlResult = {
  ma_don_ve: '100',
  ma_dinh_danh_don: 'FUTA261021000001',
  so_tien: '640000.00',
  payment_url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=FUTA1',
  het_han_thanh_toan: '2026-10-21T08:12:00.000Z',
};

const PAYLOAD = {
  ma_chuyen: 10,
  danh_sach_ghe: ['A1', 'A2'],
  owner_ref: 'hold_client_12345',
  ma_diem_don: 1,
  ma_diem_tra: 2,
  ho_ten_khach: 'Lê Văn Khách',
  so_dien_thoai_khach: '0909999999',
};

function buildApp(
  context: TestAuthContext,
  bookingService: BookingService,
  paymentService: PaymentService,
): Express {
  return createApp({
    authService: context.authService,
    tokenService: context.tokenService,
    bookingService,
    paymentService,
  });
}

function bearer(context: TestAuthContext): string {
  return `Bearer ${context.tokenService.signAccessToken(CUSTOMER)}`;
}

describe('Booking VNPAY API', () => {
  let context: TestAuthContext;
  let app: Express;
  let booking: { create: ReturnType<typeof vi.fn> };
  let payment: { createVnpayUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    context = buildTestAuth();
    booking = { create: vi.fn(async () => BOOKING) };
    payment = { createVnpayUrl: vi.fn(async () => PAYMENT) };
    app = buildApp(
      context,
      booking as unknown as BookingService,
      payment as unknown as PaymentService,
    );
  });

  it('returns a VNPAY payment URL after creating a VNPAY booking', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', bearer(context))
      .send({ ...PAYLOAD, phuong_thuc_thanh_toan: 'VNPAY' });

    expect(response.status).toBe(201);
    expect(response.body.data.don_dat_ve.ma_don_ve).toBe('100');
    expect(response.body.data.payment_url).toBe(PAYMENT.payment_url);
    expect(payment.createVnpayUrl).toHaveBeenCalledWith(
      '100',
      expect.objectContaining({ ma_nguoi_dung: '7' }),
      expect.any(String),
    );
  });

  it('does not create a payment URL for cash bookings', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', bearer(context))
      .send({ ...PAYLOAD, phuong_thuc_thanh_toan: 'TIEN_MAT' });

    expect(response.status).toBe(201);
    expect(response.body.data).not.toHaveProperty('payment_url');
    expect(payment.createVnpayUrl).not.toHaveBeenCalled();
  });
});
