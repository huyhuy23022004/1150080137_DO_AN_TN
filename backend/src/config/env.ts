import path from 'node:path';
import dotenv from 'dotenv';
import { parseDurationToSeconds } from '../utils/time';

dotenv.config({
  path: process.env.ENV_FILE ?? path.resolve(__dirname, '../../.env'),
});

type SameSiteOption = 'lax' | 'strict' | 'none';

const errors: string[] = [];

const nodeEnv = (process.env.NODE_ENV ?? 'development').trim().toLowerCase();
const isProduction = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';
const isTest = nodeEnv === 'test';

if (!['development', 'test', 'production'].includes(nodeEnv)) {
  errors.push('NODE_ENV must be one of: development, test, production');
}

function readOptionalString(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readString(name: string, fallback: string): string {
  return readOptionalString(name) ?? fallback;
}

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} must be an integer between ${min} and ${max}`);
    return fallback;
  }

  return value;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) {
    return fallback;
  }

  if (['true', '1', 'yes'].includes(raw)) {
    return true;
  }

  if (['false', '0', 'no'].includes(raw)) {
    return false;
  }

  errors.push(`${name} must be a boolean (true/false)`);
  return fallback;
}

function readList(name: string, fallback: string[]): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const values = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0) {
    errors.push(`${name} must contain at least one value`);
    return fallback;
  }

  return values;
}

function readTrustProxy(): boolean | number {
  const raw = process.env.TRUST_PROXY?.trim().toLowerCase();
  if (!raw) {
    return 1;
  }

  if (raw === 'true') {
    return true;
  }

  if (raw === 'false') {
    return false;
  }

  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    errors.push('TRUST_PROXY must be true, false or a non-negative integer');
    return 1;
  }

  return hops;
}

const defaultSameSite: SameSiteOption = 'lax';
const sameSiteRaw = (process.env.COOKIE_SAME_SITE ?? defaultSameSite).trim().toLowerCase();
const cookieSameSite: SameSiteOption = ['lax', 'strict', 'none'].includes(sameSiteRaw)
  ? (sameSiteRaw as SameSiteOption)
  : defaultSameSite;

if (cookieSameSite !== sameSiteRaw) {
  errors.push('COOKIE_SAME_SITE must be one of: lax, strict, none');
}

const accessTtlRaw = readString('JWT_ACCESS_EXPIRES_IN', '15m');
const refreshTtlRaw = readString('JWT_REFRESH_EXPIRES_IN', '7d');

let accessTtlSeconds = 900;
let refreshTtlSeconds = 604_800;

try {
  accessTtlSeconds = parseDurationToSeconds(accessTtlRaw);
} catch {
  errors.push('JWT_ACCESS_EXPIRES_IN has an invalid duration format');
}

try {
  refreshTtlSeconds = parseDurationToSeconds(refreshTtlRaw);
} catch {
  errors.push('JWT_REFRESH_EXPIRES_IN has an invalid duration format');
}

const accessSecret = readString(
  'JWT_ACCESS_SECRET',
  'dev_access_secret_change_me_32_chars_minimum',
);
const refreshSecret = readString(
  'JWT_REFRESH_SECRET',
  'dev_refresh_secret_change_me_32_chars_minimum',
);
const qrSecret = readString('QR_SECRET', 'dev_qr_secret_change_me_32_chars_minimum');

if (isProduction) {
  if (accessSecret.startsWith('dev_') || accessSecret.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be set to a strong secret in production');
  }

  if (refreshSecret.startsWith('dev_') || refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be set to a strong secret in production');
  }

  if (qrSecret.startsWith('dev_') || qrSecret.length < 32) {
    errors.push('QR_SECRET must be set to a strong secret in production');
  }
}

const cookieSecure = readBool('COOKIE_SECURE', isProduction);
if (cookieSameSite === 'none' && !cookieSecure) {
  errors.push('COOKIE_SECURE must be true when COOKIE_SAME_SITE=none');
}

const saltRounds = readInt('BCRYPT_SALT_ROUNDS', 10, 4, 15);
const seatLockTtlSeconds = readInt('SEAT_LOCK_TTL_SECONDS', 480, 60, 1_800);
const seatLockMaxExtendSeconds = readInt('SEAT_LOCK_MAX_EXTEND_SECONDS', 900, 60, 3_600);

if (seatLockMaxExtendSeconds < seatLockTtlSeconds) {
  errors.push(
    'SEAT_LOCK_MAX_EXTEND_SECONDS must be greater than or equal to SEAT_LOCK_TTL_SECONDS',
  );
}

const corsOrigins = readList('CORS_ORIGINS', ['http://localhost:5173', 'http://localhost:3001']);

if (corsOrigins.includes('*')) {
  errors.push('CORS_ORIGINS must not contain "*" when credentials are enabled');
}

const cookieDomain = readOptionalString('COOKIE_DOMAIN');

if (errors.length > 0) {
  throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
}

export const config = {
  env: nodeEnv,
  isProduction,
  isDevelopment,
  isTest,
  app: {
    name: readString('APP_NAME', 'FUTA Bus System'),
    timezone: readString('APP_TIMEZONE', 'Asia/Ho_Chi_Minh'),
  },
  server: {
    port: readInt('PORT', 3000, 1, 65_535),
    apiPrefix: readString('API_PREFIX', '/api/v1'),
    bodyLimit: readString('BODY_LIMIT', '100kb'),
    trustProxy: readTrustProxy(),
  },
  cors: {
    origins: corsOrigins,
  },
  log: {
    level: readString('LOG_LEVEL', isProduction ? 'info' : 'debug'),
    pretty: readBool('LOG_PRETTY', isDevelopment),
  },
  db: {
    host: readString('DB_HOST', '127.0.0.1'),
    port: readInt('DB_PORT', 3306, 1, 65_535),
    user: readString('DB_USER', 'futa'),
    password: readString('DB_PASSWORD', 'futa_dev_password'),
    name: readString('DB_NAME', 'quan_ly_ve_xe'),
    connectionLimit: readInt('DB_CONNECTION_LIMIT', 10, 1, 100),
    queueLimit: readInt('DB_QUEUE_LIMIT', 0, 0, 10_000),
    timezone: readString('DB_TIMEZONE', 'Z'),
    ssl: readBool('DB_SSL', false),
  },
  redis: {
    host: readString('REDIS_HOST', '127.0.0.1'),
    port: readInt('REDIS_PORT', 6379, 1, 65_535),
    password: readOptionalString('REDIS_PASSWORD'),
    db: readInt('REDIS_DB', 0, 0, 15),
    keyPrefix: readString('REDIS_KEY_PREFIX', 'futa:'),
    tls: readBool('REDIS_TLS', false),
  },
  jwt: {
    accessSecret,
    refreshSecret,
    accessTtlSeconds,
    refreshTtlSeconds,
    issuer: readString('JWT_ISSUER', 'futa-bus-system'),
    audience: readString('JWT_AUDIENCE', 'futa-client'),
  },
  cookie: {
    name: readString('REFRESH_COOKIE_NAME', 'futa_refresh_token'),
    secure: cookieSecure,
    sameSite: cookieSameSite,
    domain: cookieDomain ?? undefined,
    path: readString('COOKIE_PATH', '/api/v1/auth'),
    maxAgeMs: refreshTtlSeconds * 1_000,
  },
  security: {
    saltRounds,
    loginMaxFailedAttempts: readInt('LOGIN_MAX_FAILED_ATTEMPTS', 5, 1, 20),
    loginLockSeconds: readInt('LOGIN_LOCK_MINUTES', 15, 1, 1_440) * 60,
  },
  seatLock: {
    ttlSeconds: seatLockTtlSeconds,
    maxExtendSeconds: seatLockMaxExtendSeconds,
    mirrorEnabled: readBool('SEAT_LOCK_MIRROR_ENABLED', true),
    sweepIntervalSeconds: readInt('SEAT_LOCK_SWEEP_INTERVAL_SECONDS', 30, 5, 600),
  },
  booking: {
    paymentTimeoutMinutes: readInt('PAYMENT_TIMEOUT_MINUTES', 15, 1, 120),
    idempotencyTtlSeconds: readInt('BOOKING_IDEMPOTENCY_TTL_SECONDS', 86_400, 60, 604_800),
    maxSeatsPerOrder: readInt('MAX_SEATS_PER_ORDER', 5, 1, 20),
    tripBookingCloseMinutes: readInt('TRIP_BOOKING_CLOSE_MINUTES', 30, 0, 1_440),
    expiryScanIntervalSeconds: readInt('BOOKING_EXPIRY_INTERVAL_SECONDS', 15, 5, 600),
  },
  socket: {
    path: readString('SOCKET_PATH', '/socket.io'),
    corsOrigins: readList('SOCKET_CORS_ORIGINS', corsOrigins),
    pingIntervalMs: readInt('SOCKET_PING_INTERVAL_MS', 25_000, 5_000, 120_000),
    pingTimeoutMs: readInt('SOCKET_PING_TIMEOUT_MS', 20_000, 5_000, 120_000),
  },
  vnpay: {
    tmnCode: readOptionalString('VNP_TMN_CODE'),
    hashSecret: readOptionalString('VNP_HASH_SECRET'),
    url: readString('VNP_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
    apiUrl: readString(
      'VNP_API_URL',
      'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
    ),
    returnUrl: readString('VNP_RETURN_URL', 'http://localhost:3000/api/v1/payments/vnpay/return'),
    ipnUrl: readString('VNP_IPN_URL', 'http://localhost:3000/api/v1/payments/vnpay/ipn'),
    version: readString('VNP_VERSION', '2.1.0'),
    command: readString('VNP_COMMAND', 'pay'),
    currCode: readString('VNP_CURR_CODE', 'VND'),
    locale: readString('VNP_LOCALE', 'vn'),
    orderType: readString('VNP_ORDER_TYPE', 'other'),
    paymentExpireMinutes: readInt('VNP_PAYMENT_EXPIRE_MINUTES', 12, 1, 60),
    resultRedirectUrl: readString(
      'PAYMENT_RESULT_REDIRECT_URL',
      'http://localhost:5173/payment/result',
    ),
    mobileDeeplinkScheme: readString('MOBILE_DEEPLINK_SCHEME', 'futaapp'),
  },
  qr: {
    secret: qrSecret,
    issuer: readString('QR_ISSUER', 'FUTA'),
    checkinOpenHoursBefore: readInt('QR_CHECKIN_OPEN_HOURS_BEFORE', 24, 0, 168),
    checkinCloseHoursAfter: readInt('QR_CHECKIN_CLOSE_HOURS_AFTER', 2, 0, 168),
  },
  rateLimit: {
    windowMs: readInt('RATE_LIMIT_WINDOW_MS', 60_000, 1_000, 3_600_000),
    max: readInt('RATE_LIMIT_MAX', 100, 1, 100_000),
    authMax: readInt('AUTH_RATE_LIMIT_MAX', 10, 1, 100_000),
    holdMax: readInt('HOLD_RATE_LIMIT_MAX', 30, 1, 100_000),
    ipnMax: readInt('IPN_RATE_LIMIT_MAX', 120, 1, 100_000),
  },
  admin: {
    phone: readOptionalString('ADMIN_PHONE'),
    password: readOptionalString('ADMIN_PASSWORD'),
  },
  seedDemoData: readBool('SEED_DEMO_DATA', true),
} as const;
