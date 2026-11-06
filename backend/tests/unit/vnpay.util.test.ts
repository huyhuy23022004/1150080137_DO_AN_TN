import { describe, expect, it } from 'vitest';
import {
  buildVnpayPaymentUrl,
  buildVnpaySignData,
  formatVnpayDate,
  toVnpayOrderInfo,
  verifyVnpaySignature,
  type VnpaySettings,
} from '../../src/utils/vnpay';

const SETTINGS: VnpaySettings = {
  tmnCode: 'FUTATEST',
  hashSecret: 'test_vnpay_hash_secret_at_least_32_characters',
  url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'http://localhost:3000/api/v1/payments/vnpay/return',
  version: '2.1.0',
  command: 'pay',
  currCode: 'VND',
  locale: 'vn',
  orderType: 'other',
  expireMinutes: 12,
};

function queryParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  new URL(url).searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

describe('VNPAY utilities', () => {
  it('formats create/expire dates in GMT+7', () => {
    const createdAt = new Date('2026-10-21T08:00:00.000Z');

    expect(formatVnpayDate(createdAt)).toBe('20261021150000');
    expect(formatVnpayDate(new Date(createdAt.getTime() + 12 * 60_000))).toBe('20261021151200');
  });

  it('strips Vietnamese diacritics from order info', () => {
    expect(toVnpayOrderInfo('Thanh toán vé FUTA Đà Lạt')).toBe('Thanh toan ve FUTA Da Lat');
  });

  it('builds a signed sandbox payment URL', () => {
    const url = buildVnpayPaymentUrl(SETTINGS, {
      txnRef: 'FUTA261021000001',
      amount: '640000.00',
      orderInfo: 'Thanh toan ve FUTA',
      ipAddr: '127.0.0.1',
      createdAt: new Date('2026-10-21T08:00:00.000Z'),
    });

    const params = queryParams(url);

    expect(url.startsWith(SETTINGS.url)).toBe(true);
    expect(params.vnp_TmnCode).toBe('FUTATEST');
    expect(params.vnp_TxnRef).toBe('FUTA261021000001');
    expect(params.vnp_Amount).toBe('64000000');
    expect(params.vnp_CreateDate).toBe('20261021150000');
    expect(params.vnp_ExpireDate).toBe('20261021151200');
    expect(params.vnp_SecureHash).toMatch(/^[a-f0-9]{128}$/);
    expect(verifyVnpaySignature(params, SETTINGS.hashSecret)).toBe(true);
  });

  it('rejects tampered amount and malformed signatures', () => {
    const url = buildVnpayPaymentUrl(SETTINGS, {
      txnRef: 'FUTA261021000001',
      amount: '640000.00',
      orderInfo: 'Thanh toan ve FUTA',
      ipAddr: '127.0.0.1',
      createdAt: new Date('2026-10-21T08:00:00.000Z'),
    });

    const params = queryParams(url);
    expect(verifyVnpaySignature({ ...params, vnp_Amount: '1' }, SETTINGS.hashSecret)).toBe(false);
    expect(verifyVnpaySignature({ ...params, vnp_SecureHash: 'abc' }, SETTINGS.hashSecret)).toBe(
      false,
    );
  });

  it('sorts keys alphabetically when creating sign data', () => {
    expect(buildVnpaySignData({ b: '2', a: '1', vnp_SecureHash: 'ignored' })).toBe('a=1&b=2');
  });
});
