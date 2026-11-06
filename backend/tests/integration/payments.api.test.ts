import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import type { AuthUserRecord } from '../../src/modules/auth/auth.types';
import type { PaymentService } from '../../src/modules/payments/payments.service';
import type {
  VnpayCreateUrlResult,
  VnpayProcessResult,
} from '../../src/modules/payments/payments.types';
import { buildTestAuth, type TestAuthContext } from '../helpers/build-test-auth';

const CUSTOMER: AuthUserRecord = {
  ma_nguoi_dung: '7',
  ma_vai_tro: 1,
  ma_chi_nhanh: null,
  ho_va_ten: 'Nguyá»…n VÄƒn A',
  so_dien_thoai: '0901234567',
  email: 'a@example.com',
  mat_khau_ma_hoa: 'hash',
  trang_thai_tai_khoan: 'HOAT_DONG',
  thoi_gian_tao: '2026-01-01T00:00:00.000Z',
  ten_vai_tro: 'KHACH_HANG',
};

const PAYMENT: VnpayCreateUrlResult = {
  ma_don_ve: '100',
  ma_dinh_danh_don: 'FUTA261021000001',
  so_tien: '640000.00',
  payment_url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=FUTA1',
  het_han_thanh_toan: '2026-10-21T08:12:00.000Z',
};

const PAID: VnpayProcessResult = {
  rsp_code: '00',
  message: 'XÃ¡c nháº­n thanh toÃ¡n thÃ nh cÃ´ng',
  thanh_cong: true,
  already_confirmed: false,
  ma_don_ve: '100',
  ma_dinh_danh_don: 'FUTA261021000001',
  ma_giao_dich_vnpay: '14000001',
  trang_thai_don: 'DA_THANH_TOAN',
};

function buildApp(context: TestAuthContext, paymentService: PaymentService) {
  return createApp({
    authService: context.authService,
    tokenService: context.tokenService,
    paymentService,
  });
}

function bearer(context: TestAuthContext, user: AuthUserRecord = CUSTOMER): string {
  return `Bearer ${context.tokenService.signAccessToken(user)}`;
}

describe('Payments API', () => {
  let context: TestAuthContext;
  let app: Express;
  let service: {
    createVnpayUrl: ReturnType<typeof vi.fn>;
    processVnpayCallback: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    context = buildTestAuth();
    service = {
      createVnpayUrl: vi.fn(async () => PAYMENT),
      processVnpayCallback: vi.fn(async () => PAID),
    };
    app = buildApp(context, service as unknown as PaymentService);
  });

  it('creates a VNPAY URL for an authenticated customer', async () => {
    const response = await request(app)
      .post('/api/v1/payments/vnpay/create-url')
      .set('Authorization', bearer(context))
      .send({ ma_don_ve: 100 });

    expect(response.status).toBe(201);
    expect(response.body.data.thanh_toan).toEqual(PAYMENT);
    expect(service.createVnpayUrl).toHaveBeenCalledWith(
      '100',
      expect.objectContaining({ ma_nguoi_dung: '7', ten_vai_tro: 'KHACH_HANG' }),
      expect.any(String),
    );
  });

  it('requires authentication to create a payment URL', async () => {
    const response = await request(app)
      .post('/api/v1/payments/vnpay/create-url')
      .send({ ma_don_ve: 100 });

    expect(response.status).toBe(401);
    expect(service.createVnpayUrl).not.toHaveBeenCalled();
  });

  it('answers VNPAY IPN with HTTP 200 and RspCode', async () => {
    const response = await request(app)
      .get('/api/v1/payments/vnpay/ipn')
      .query({ vnp_TxnRef: 'FUTA261021000001' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      RspCode: '00',
      Message: 'XÃ¡c nháº­n thanh toÃ¡n thÃ nh cÃ´ng',
    });
  });

  it('always answers IPN with HTTP 200 even on unexpected errors', async () => {
    service.processVnpayCallback.mockRejectedValueOnce(new Error('boom'));

    const response = await request(app)
      .get('/api/v1/payments/vnpay/ipn')
      .query({ vnp_TxnRef: 'FUTA261021000001' });

    expect(response.status).toBe(200);
    expect(response.body.RspCode).toBe('99');
  });

  it('returns the payment result on the browser return URL', async () => {
    const response = await request(app)
      .get('/api/v1/payments/vnpay/return')
      .query({ vnp_TxnRef: 'FUTA261021000001', vnp_ResponseCode: '00' });

    expect(response.status).toBe(200);
    expect(response.body.data.ket_qua_thanh_toan.rsp_code).toBe('00');
  });

  it('maps invalid signatures on the return URL to a 400 response', async () => {
    service.processVnpayCallback.mockResolvedValueOnce({
      ...PAID,
      rsp_code: '97',
      message: 'Chá»¯ kÃ½ khÃ´ng há»£p lá»‡',
      thanh_cong: false,
    });

    const response = await request(app)
      .get('/api/v1/payments/vnpay/return')
      .query({ vnp_TxnRef: 'FUTA261021000001' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PAYMENT_INVALID_SIGNATURE');
  });
});
