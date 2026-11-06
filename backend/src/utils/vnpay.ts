import { createHmac, timingSafeEqual } from 'node:crypto';
import Decimal from 'decimal.js';

export interface VnpaySettings {
  tmnCode: string;
  hashSecret: string;
  url: string;
  returnUrl: string;
  version: string;
  command: string;
  currCode: string;
  locale: string;
  orderType: string;
  expireMinutes: number;
}

export interface VnpayBuildInput {
  txnRef: string;
  amount: string;
  orderInfo: string;
  ipAddr: string;
  createdAt?: Date;
  returnUrl?: string;
}

const VNPAY_TIMEZONE_OFFSET_MINUTES = 7 * 60;
const SECURE_HASH_PATTERN = /^[a-f0-9]{128}$/i;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

export function formatVnpayDate(value: Date): string {
  const shifted = new Date(value.getTime() + VNPAY_TIMEZONE_OFFSET_MINUTES * 60_000);

  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate()),
    pad(shifted.getUTCHours()),
    pad(shifted.getUTCMinutes()),
    pad(shifted.getUTCSeconds()),
  ].join('');
}

export function toVnpayOrderInfo(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 .,_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (normalized || 'Thanh toan don hang FUTA').slice(0, 255);
}

function encodeValue(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

export function buildVnpaySignData(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
    .filter((key) => {
      const value = params[key];
      return typeof value === 'string' && value.length > 0;
    })
    .sort()
    .map((key) => `${key}=${encodeValue(params[key] as string)}`)
    .join('&');
}

export function createVnpaySignature(params: Record<string, string>, hashSecret: string): string {
  return createHmac('sha512', hashSecret).update(buildVnpaySignData(params)).digest('hex');
}

export function buildVnpayPaymentUrl(settings: VnpaySettings, input: VnpayBuildInput): string {
  const createdAt = input.createdAt ?? new Date();
  const expireAt = new Date(createdAt.getTime() + settings.expireMinutes * 60_000);

  const params: Record<string, string> = {
    vnp_Version: settings.version,
    vnp_Command: settings.command,
    vnp_TmnCode: settings.tmnCode,
    vnp_Locale: settings.locale,
    vnp_CurrCode: settings.currCode,
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: toVnpayOrderInfo(input.orderInfo),
    vnp_OrderType: settings.orderType,
    vnp_Amount: new Decimal(input.amount).mul(100).toFixed(0),
    vnp_ReturnUrl: input.returnUrl ?? settings.returnUrl,
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: formatVnpayDate(createdAt),
    vnp_ExpireDate: formatVnpayDate(expireAt),
  };

  const signData = buildVnpaySignData(params);
  const secureHash = createVnpaySignature(params, settings.hashSecret);

  return `${settings.url}?${signData}&vnp_SecureHash=${secureHash}`;
}

export function verifyVnpaySignature(params: Record<string, string>, hashSecret: string): boolean {
  const received = params.vnp_SecureHash;
  if (!received || !SECURE_HASH_PATTERN.test(received)) {
    return false;
  }

  const expected = createVnpaySignature(params, hashSecret);
  const expectedBuffer = Buffer.from(expected.toLowerCase(), 'utf8');
  const receivedBuffer = Buffer.from(received.toLowerCase(), 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function extractVnpayParams(query: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, raw] of Object.entries(query)) {
    if (!key.startsWith('vnp_')) {
      continue;
    }

    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string') {
      params[key] = value;
    }
  }

  return params;
}
