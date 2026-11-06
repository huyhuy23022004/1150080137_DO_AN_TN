import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config/env';

const QR_PREFIX = 'FUTA1';

export interface TicketQrPayload {
  iss: string;
  ma_chuyen: number;
  ky_hieu_ghe: string;
  nonce: string;
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function sign(payloadBase64: string): string {
  return createHmac('sha256', config.qr.secret).update(payloadBase64).digest('base64url');
}

export function createTicketQrToken(input: {
  ma_chuyen: number;
  ky_hieu_ghe: string;
  nonce?: string;
}): string {
  const payload: TicketQrPayload = {
    iss: config.qr.issuer,
    ma_chuyen: input.ma_chuyen,
    ky_hieu_ghe: input.ky_hieu_ghe,
    nonce: input.nonce ?? randomUUID(),
  };

  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
  return `${QR_PREFIX}.${payloadBase64}.${sign(payloadBase64)}`;
}

export function verifyTicketQrToken(token: string): TicketQrPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== QR_PREFIX) {
    return null;
  }

  const payloadBase64 = parts[1];
  const signature = parts[2];

  if (!payloadBase64 || !signature) {
    return null;
  }

  const expected = Buffer.from(sign(payloadBase64));
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf8'),
    ) as TicketQrPayload | null;

    if (
      !decoded ||
      decoded.iss !== config.qr.issuer ||
      typeof decoded.ma_chuyen !== 'number' ||
      typeof decoded.ky_hieu_ghe !== 'string' ||
      typeof decoded.nonce !== 'string'
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
