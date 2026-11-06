import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES } from '../../src/common/constants';
import { createApp } from '../../src/app';
import { buildTestAuth, type TestAuthContext } from '../helpers/build-test-auth';

interface AuthResponseBody {
  success: true;
  data: {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    nguoi_dung: {
      ma_nguoi_dung: string;
      ho_va_ten: string;
      so_dien_thoai: string;
      email: string | null;
      ma_chi_nhanh: number | null;
      ten_vai_tro: string;
      trang_thai_tai_khoan: string;
      thoi_gian_tao: string;
    };
  };
}

interface ErrorBody {
  success: false;
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
}

const REGISTER_PAYLOAD = {
  ho_va_ten: 'Nguyễn Văn A',
  so_dien_thoai: '0901234567',
  email: 'a@example.com',
  mat_khau: 'MatKhau@123',
  xac_nhan_mat_khau: 'MatKhau@123',
};

const LOGIN_PAYLOAD = {
  so_dien_thoai: '0901234567',
  mat_khau: 'MatKhau@123',
};

function authBody(response: { body: unknown }): AuthResponseBody {
  return response.body as AuthResponseBody;
}

function errorBody(response: { body: unknown }): ErrorBody {
  return response.body as ErrorBody;
}

function getSetCookie(response: { headers: Record<string, unknown> }): string {
  const header = response.headers['set-cookie'];

  if (Array.isArray(header) && typeof header[0] === 'string') {
    return header[0];
  }

  if (typeof header === 'string') {
    return header;
  }

  throw new Error('Response did not include a Set-Cookie header');
}

function cookiePair(setCookie: string): string {
  const [pair] = setCookie.split(';');
  return pair ?? '';
}

async function register(app: Express, overrides: Partial<typeof REGISTER_PAYLOAD> = {}) {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ ...REGISTER_PAYLOAD, ...overrides });
}

async function login(
  app: Express,
  payload: Partial<typeof LOGIN_PAYLOAD> = {},
): Promise<request.Response> {
  return request(app)
    .post('/api/v1/auth/login')
    .send({ ...LOGIN_PAYLOAD, ...payload });
}

describe('Auth API', () => {
  let context: TestAuthContext;
  let app: Express;

  beforeEach(() => {
    context = buildTestAuth();
    app = createApp({
      authService: context.authService,
      tokenService: context.tokenService,
    });
  });

  it('registers a customer and returns an access token with refresh cookie', async () => {
    const response = await register(app, { email: ' A@Example.COM ' });
    const body = authBody(response);

    expect(response.status).toBe(201);
    expect(body.data.nguoi_dung.so_dien_thoai).toBe('0901234567');
    expect(body.data.nguoi_dung.email).toBe('a@example.com');
    expect(body.data.nguoi_dung.ten_vai_tro).toBe(ROLES.KHACH_HANG);
    expect(body.data.token_type).toBe('Bearer');
    expect(body.data.expires_in).toBe(900);
    expect(body.data.access_token.length).toBeGreaterThan(20);
    expect(JSON.stringify(response.body)).not.toContain('refresh_token');

    const setCookie = getSetCookie(response);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).toContain('Path=/api/v1/auth');
    expect(setCookie).toContain('futa_refresh_token=');
    expect(context.refreshTokenStore.activeCount(body.data.nguoi_dung.ma_nguoi_dung)).toBe(1);
  });

  it('rejects duplicate phone and duplicate email', async () => {
    await register(app);

    const duplicatePhone = await register(app, {
      email: 'other@example.com',
    });
    expect(duplicatePhone.status).toBe(409);
    expect(errorBody(duplicatePhone).code).toBe('AUTH_PHONE_EXISTS');

    const duplicateEmail = await register(app, {
      so_dien_thoai: '0912345678',
    });
    expect(duplicateEmail.status).toBe(409);
    expect(errorBody(duplicateEmail).code).toBe('AUTH_EMAIL_EXISTS');
  });

  it('validates registration input', async () => {
    const response = await register(app, {
      so_dien_thoai: '12345',
      mat_khau: 'short',
      xac_nhan_mat_khau: 'short',
    });
    const body = errorBody(response);

    expect(response.status).toBe(422);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details?.some((detail) => detail.field === 'so_dien_thoai')).toBe(true);
    expect(body.details?.some((detail) => detail.field === 'mat_khau')).toBe(true);
  });

  it('logs in with a normalized phone and returns the current profile', async () => {
    await register(app);

    const loginResponse = await login(app, { so_dien_thoai: '+84 90 123 4567' });
    const loginBody = authBody(loginResponse);

    expect(loginResponse.status).toBe(200);
    expect(loginBody.data.nguoi_dung.ho_va_ten).toBe('Nguyễn Văn A');

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginBody.data.access_token}`);

    expect(meResponse.status).toBe(200);
    expect(
      (meResponse.body as { data: { nguoi_dung: { so_dien_thoai: string } } }).data.nguoi_dung
        .so_dien_thoai,
    ).toBe('0901234567');
  });

  it('requires an access token for the profile endpoint', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(errorBody(response).code).toBe('AUTH_TOKEN_MISSING');
  });

  it('updates the current profile and validates uniqueness', async () => {
    const first = await register(app);
    const firstToken = authBody(first).data.access_token;
    const second = await register(app, {
      ho_va_ten: 'Tran Thi B',
      so_dien_thoai: '0912345678',
      email: 'b@example.com',
    });

    const updateResponse = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({
        ho_va_ten: 'Nguyen Van A Updated',
        so_dien_thoai: '+84 90 123 4567',
        email: 'updated@example.com',
      });

    expect(updateResponse.status).toBe(200);
    expect(
      (
        updateResponse.body as {
          data: { nguoi_dung: { ho_va_ten: string; so_dien_thoai: string; email: string } };
        }
      ).data.nguoi_dung,
    ).toMatchObject({
      ho_va_ten: 'Nguyen Van A Updated',
      so_dien_thoai: '0901234567',
      email: 'updated@example.com',
    });

    const duplicateResponse = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({
        so_dien_thoai: '0912345678',
        email: 'b@example.com',
      });

    expect(duplicateResponse.status).toBe(409);
    expect(errorBody(duplicateResponse).code).toBe('AUTH_PHONE_EXISTS');

    const secondToken = authBody(second).data.access_token;
    const duplicateEmailResponse = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ email: 'updated@example.com' });

    expect(duplicateEmailResponse.status).toBe(409);
    expect(errorBody(duplicateEmailResponse).code).toBe('AUTH_EMAIL_EXISTS');
  });

  it('rejects an empty profile update payload', async () => {
    const registerResponse = await register(app);

    const response = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authBody(registerResponse).data.access_token}`)
      .send({});

    expect(response.status).toBe(422);
    expect(errorBody(response).code).toBe('VALIDATION_ERROR');
  });

  it('returns a refresh token to mobile clients and accepts it in the request body', async () => {
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Client-Type', 'mobile')
      .send(REGISTER_PAYLOAD);
    const registerBody = authBody(registerResponse);
    const firstRefreshToken = registerBody.data.refresh_token;

    expect(registerResponse.status).toBe(201);
    expect(typeof firstRefreshToken).toBe('string');
    expect(firstRefreshToken?.length).toBeGreaterThan(20);

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Type', 'mobile')
      .send({ refresh_token: firstRefreshToken });

    expect(refreshResponse.status).toBe(200);
    const refreshBody = authBody(refreshResponse);
    expect(typeof refreshBody.data.refresh_token).toBe('string');
    expect(refreshBody.data.refresh_token).not.toBe(firstRefreshToken);
    expect(getSetCookie(refreshResponse)).toContain('futa_refresh_token=');
  });

  it('keeps refresh tokens out of the response for web clients', async () => {
    const registerResponse = await register(app);
    const cookie = cookiePair(getSetCookie(registerResponse));

    const refreshResponse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(refreshResponse.status).toBe(200);
    expect(JSON.stringify(refreshResponse.body)).not.toContain('refresh_token');
  });

  it('rejects invalid credentials and locks the account after five failures', async () => {
    await register(app);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login(app, { mat_khau: 'WrongPassword123' });
      expect(response.status).toBe(401);
      expect(errorBody(response).code).toBe('AUTH_INVALID_CREDENTIALS');
    }

    const lockedResponse = await login(app);
    expect(lockedResponse.status).toBe(429);
    expect(errorBody(lockedResponse).code).toBe('AUTH_ACCOUNT_LOCKED');
  });

  it('rotates refresh tokens and revokes all sessions when a token is reused', async () => {
    const registerResponse = await register(app);
    const oldCookie = cookiePair(getSetCookie(registerResponse));

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldCookie);

    expect(refreshResponse.status).toBe(200);
    const newCookie = cookiePair(getSetCookie(refreshResponse));
    expect(newCookie).not.toBe(oldCookie);

    const replayResponse = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);

    expect(replayResponse.status).toBe(401);
    expect(errorBody(replayResponse).code).toBe('AUTH_REFRESH_REUSED');

    const revokedResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', newCookie);

    expect(revokedResponse.status).toBe(401);
    expect(errorBody(revokedResponse).code).toBe('AUTH_REFRESH_INVALID');
  });

  it('logs out and invalidates the refresh token', async () => {
    const registerResponse = await register(app);
    const cookie = cookiePair(getSetCookie(registerResponse));

    const logoutResponse = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);

    expect(logoutResponse.status).toBe(200);
    expect(getSetCookie(logoutResponse)).toContain('futa_refresh_token=;');

    const refreshResponse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(refreshResponse.status).toBe(401);
    expect(errorBody(refreshResponse).code).toBe('AUTH_REFRESH_INVALID');
  });

  it('changes the password, revokes sessions, and requires the new password', async () => {
    const registerResponse = await register(app);
    const cookie = cookiePair(getSetCookie(registerResponse));
    const accessToken = authBody(registerResponse).data.access_token;

    const changeResponse = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        mat_khau_cu: 'MatKhau@123',
        mat_khau_moi: 'MatKhauMoi@456',
        xac_nhan_mat_khau_moi: 'MatKhauMoi@456',
      });

    expect(changeResponse.status).toBe(200);

    const refreshResponse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshResponse.status).toBe(401);

    const oldPasswordResponse = await login(app);
    expect(oldPasswordResponse.status).toBe(401);

    const newPasswordResponse = await login(app, { mat_khau: 'MatKhauMoi@456' });
    expect(newPasswordResponse.status).toBe(200);
  });

  it('logs out all devices', async () => {
    await register(app);

    const firstLogin = await login(app);
    const secondLogin = await login(app);
    const firstCookie = cookiePair(getSetCookie(firstLogin));
    const secondCookie = cookiePair(getSetCookie(secondLogin));
    const accessToken = authBody(firstLogin).data.access_token;

    const logoutAll = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(logoutAll.status).toBe(200);

    const firstRefresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);
    const secondRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', secondCookie);

    expect(firstRefresh.status).toBe(401);
    expect(secondRefresh.status).toBe(401);
  });

  it('reports liveness without external dependencies', async () => {
    const response = await request(app).get('/livez');

    expect(response.status).toBe(200);
    expect((response.body as { status: string }).status).toBe('ok');
  });

  it('returns a trace id for unknown endpoints', async () => {
    const response = await request(app)
      .get('/api/v1/khong-ton-tai')
      .set('X-Request-Id', 'test-request-123');

    expect(response.status).toBe(404);
    expect(errorBody(response).code).toBe('NOT_FOUND');
    expect((response.body as { trace_id: string }).trace_id).toBe('test-request-123');
    expect(response.headers['x-request-id']).toBe('test-request-123');
  });

  it('returns a trace id for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"so_dien_thoai":');

    expect(response.status).toBe(400);
    expect(errorBody(response).code).toBe('INVALID_JSON');
    expect(typeof (response.body as { trace_id: unknown }).trace_id).toBe('string');
  });
});
