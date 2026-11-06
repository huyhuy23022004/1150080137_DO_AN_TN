import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '../../src/common/errors/error-codes';
import { onSeatBooked } from '../../src/realtime/events';
import { PaymentService } from '../../src/modules/payments/payments.service';
import type {
  PaymentOrderRecord,
  PaymentRepositoryPort,
  PaymentTransactionRecord,
} from '../../src/modules/payments/payments.types';
import { createVnpaySignature, type VnpaySettings } from '../../src/utils/vnpay';

vi.mock('../../src/db/transaction', () => ({
  withTransaction: async <T>(work: (connection: object) => Promise<T>): Promise<T> => work({}),
}));

const NOW = new Date('2026-10-21T08:00:00.000Z');
const SECRET = 'test_vnpay_hash_secret_at_least_32_characters';
const ORDER_CODE = 'FUTA261021000001';

const SETTINGS: VnpaySettings = {
  tmnCode: 'FUTATEST',
  hashSecret: SECRET,
  url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'http://localhost:3000/api/v1/payments/vnpay/return',
  version: '2.1.0',
  command: 'pay',
  currCode: 'VND',
  locale: 'vn',
  orderType: 'other',
  expireMinutes: 12,
};

const CUSTOMER = {
  ma_nguoi_dung: '7',
  ten_vai_tro: 'KHACH_HANG' as const,
  ma_chi_nhanh: null,
};

interface HarnessOptions {
  orderStatus?: string;
  paymentStatus?: string;
  orderCustomer?: string | null;
}

function createHarness(options: HarnessOptions = {}) {
  const state = {
    orderStatus: options.orderStatus ?? 'CHO_THANH_TOAN',
    paymentStatus: options.paymentStatus ?? 'CHO_XU_LY',
  };

  const order: PaymentOrderRecord = {
    ma_don_ve: '100',
    ma_dinh_danh_don: ORDER_CODE,
    ma_khach_hang: options.orderCustomer ?? '7',
    ma_chi_nhanh_ban: null,
    trang_thai_don: state.orderStatus,
    tong_tien: '640000.00',
    thoi_gian_tao: NOW.toISOString(),
    ma_chuyen: 10,
    danh_sach_ghe: ['A1', 'A2'],
  };

  const payment: PaymentTransactionRecord = {
    ma_thanh_toan: '55',
    ma_don_ve: order.ma_don_ve,
    phuong_thuc: 'VNPAY',
    ma_giao_dich_vnpay: null,
    so_tien: order.tong_tien,
    trang_thai: state.paymentStatus,
  };

  function currentOrder(): PaymentOrderRecord {
    return { ...order, trang_thai_don: state.orderStatus };
  }

  function currentPayment(): PaymentTransactionRecord {
    return { ...payment, trang_thai: state.paymentStatus };
  }

  const repository: PaymentRepositoryPort = {
    findOrderById: vi.fn(async () => currentOrder()),
    findOrderByIdentifier: vi.fn(async () => currentOrder()),
    lockOrderByIdentifier: vi.fn(async () => currentOrder()),
    findVnpayPayment: vi.fn(async () => currentPayment()),
    markPaymentSuccess: vi.fn(async (input) => {
      state.paymentStatus = 'THANH_CONG';
      payment.ma_giao_dich_vnpay = input.ma_giao_dich_vnpay;
    }),
    markPaymentFailed: vi.fn(async () => {
      state.paymentStatus = 'THAT_BAI';
    }),
    markOrderPaid: vi.fn(async () => {
      state.orderStatus = 'DA_THANH_TOAN';
    }),
    findOrderSeats: vi.fn(async () => ({
      ma_chuyen: 10,
      danh_sach_ghe: ['A1', 'A2'],
    })),
  };

  const service = new PaymentService({
    repository,
    settings: SETTINGS,
    now: () => NOW,
  });

  return { service, repository, state, order };
}

function callbackParams(overrides: Record<string, string> = {}): Record<string, string> {
  const params: Record<string, string> = {
    vnp_TxnRef: ORDER_CODE,
    vnp_Amount: '64000000',
    vnp_ResponseCode: '00',
    vnp_TransactionStatus: '00',
    vnp_TransactionNo: '14000001',
    vnp_BankCode: 'NCB',
    vnp_PayDate: '20261021150100',
    vnp_OrderInfo: 'Thanh toan ve FUTA',
    ...overrides,
  };

  params.vnp_SecureHash = createVnpaySignature(params, SECRET);
  return params;
}

describe('PaymentService - VNPAY', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a signed VNPAY payment URL for a pending order', async () => {
    const harness = createHarness();
    const result = await harness.service.createVnpayUrl('100', CUSTOMER, '127.0.0.1');

    expect(result.ma_don_ve).toBe('100');
    expect(result.so_tien).toBe('640000.00');
    expect(result.payment_url).toContain('vnp_TxnRef=FUTA261021000001');
    expect(result.payment_url).toContain('vnp_Amount=64000000');
    expect(result.payment_url).toContain('vnp_CreateDate=20261021150000');
    expect(result.payment_url).toContain('vnp_ExpireDate=20261021151200');
    expect(result.het_han_thanh_toan).toBe('2026-10-21T08:12:00.000Z');
  });

  it('blocks another customer from creating a payment URL', async () => {
    const harness = createHarness({ orderCustomer: '8' });

    await expect(
      harness.service.createVnpayUrl('100', CUSTOMER, '127.0.0.1'),
    ).rejects.toMatchObject({ code: ERROR_CODES.FORBIDDEN });
  });

  it('rejects an invalid signature without touching the order', async () => {
    const harness = createHarness();
    const params = callbackParams();
    params.vnp_Amount = '1';

    const result = await harness.service.processVnpayCallback(params);

    expect(result.rsp_code).toBe('97');
    expect(harness.repository.markPaymentSuccess).not.toHaveBeenCalled();
    expect(harness.repository.markOrderPaid).not.toHaveBeenCalled();
  });

  it('rejects an amount mismatch with RspCode 04', async () => {
    const harness = createHarness();
    const params = callbackParams({ vnp_Amount: '1' });

    const result = await harness.service.processVnpayCallback(params);

    expect(result.rsp_code).toBe('04');
    expect(harness.repository.markPaymentSuccess).not.toHaveBeenCalled();
  });

  it('confirms payment, locks the order and broadcasts seat:booked', async () => {
    const harness = createHarness();
    const booked: Array<{ ma_don_ve: string; trang_thai_don: string }> = [];
    const unsubscribe = onSeatBooked((event) => {
      booked.push({ ma_don_ve: event.ma_don_ve, trang_thai_don: event.trang_thai_don });
    });

    const result = await harness.service.processVnpayCallback(callbackParams());

    expect(result.rsp_code).toBe('00');
    expect(result.thanh_cong).toBe(true);
    expect(result.trang_thai_don).toBe('DA_THANH_TOAN');
    expect(harness.state.orderStatus).toBe('DA_THANH_TOAN');
    expect(harness.state.paymentStatus).toBe('THANH_CONG');
    expect(harness.repository.markPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ ma_thanh_toan: '55', ma_giao_dich_vnpay: '14000001' }),
      expect.anything(),
    );
    expect(booked).toEqual([{ ma_don_ve: '100', trang_thai_don: 'DA_THANH_TOAN' }]);

    unsubscribe();
  });

  it('is idempotent when VNPAY calls IPN repeatedly', async () => {
    const harness = createHarness();
    const booked: string[] = [];
    const unsubscribe = onSeatBooked((event) => booked.push(event.ma_don_ve));

    const first = await harness.service.processVnpayCallback(callbackParams());
    const second = await harness.service.processVnpayCallback(callbackParams());

    expect(first.rsp_code).toBe('00');
    expect(second.rsp_code).toBe('02');
    expect(second.already_confirmed).toBe(true);
    expect(harness.repository.markPaymentSuccess).toHaveBeenCalledTimes(1);
    expect(booked).toEqual(['100']);

    unsubscribe();
  });

  it('records a failed VNPAY transaction and keeps the order pending', async () => {
    const harness = createHarness();
    const result = await harness.service.processVnpayCallback(
      callbackParams({ vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }),
    );

    expect(result.rsp_code).toBe('00');
    expect(result.thanh_cong).toBe(false);
    expect(harness.state.paymentStatus).toBe('THAT_BAI');
    expect(harness.state.orderStatus).toBe('CHO_THANH_TOAN');
    expect(harness.repository.markOrderPaid).not.toHaveBeenCalled();
  });

  it('does not reopen a cancelled order when payment arrives late', async () => {
    const harness = createHarness({ orderStatus: 'DA_HUY' });
    const result = await harness.service.processVnpayCallback(callbackParams());

    expect(result.rsp_code).toBe('00');
    expect(result.thanh_cong).toBe(false);
    expect(harness.repository.markPaymentSuccess).not.toHaveBeenCalled();
    expect(harness.repository.markOrderPaid).not.toHaveBeenCalled();
  });
});
