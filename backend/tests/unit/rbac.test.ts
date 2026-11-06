import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ROLES } from '../../src/common/constants';
import { createAuthMiddleware } from '../../src/middlewares/auth.middleware';
import { errorMiddleware } from '../../src/middlewares/error.middleware';
import { requestIdMiddleware } from '../../src/middlewares/request-id.middleware';
import { requireRoles } from '../../src/middlewares/rbac.middleware';
import type { AuthUserRecord } from '../../src/modules/auth/auth.types';
import { TokenService } from '../../src/modules/auth/token.service';
import { TEST_TOKEN_SETTINGS } from '../helpers/build-test-auth';

function buildUser(role: AuthUserRecord['ten_vai_tro']): AuthUserRecord {
  return {
    ma_nguoi_dung: '1',
    ma_vai_tro: 1,
    ma_chi_nhanh: null,
    ho_va_ten: 'Test User',
    so_dien_thoai: '0901234567',
    email: null,
    mat_khau_ma_hoa: 'hash',
    trang_thai_tai_khoan: 'HOAT_DONG',
    thoi_gian_tao: '2026-01-01T00:00:00.000Z',
    ten_vai_tro: role,
  };
}

describe('auth and RBAC middlewares', () => {
  const tokenService = new TokenService(TEST_TOKEN_SETTINGS);
  const authenticate = createAuthMiddleware(tokenService);

  const app = express();
  app.use(requestIdMiddleware);
  app.get('/protected', authenticate, (req, res) => {
    res.json({ success: true, data: req.user });
  });
  app.get('/admin', authenticate, requireRoles(ROLES.QUAN_TRI_VIEN), (_req, res) => {
    res.json({ success: true, data: { admin: true } });
  });
  app.use(errorMiddleware);

  it('rejects a request without access token', async () => {
    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_TOKEN_MISSING');
  });

  it('accepts a customer token on a protected route', async () => {
    const token = tokenService.signAccessToken(buildUser(ROLES.KHACH_HANG));
    const response = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.ten_vai_tro).toBe(ROLES.KHACH_HANG);
  });

  it('forbids a customer from an admin route', async () => {
    const token = tokenService.signAccessToken(buildUser(ROLES.KHACH_HANG));
    const response = await request(app).get('/admin').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('allows an admin on an admin route', async () => {
    const token = tokenService.signAccessToken(buildUser(ROLES.QUAN_TRI_VIEN));
    const response = await request(app).get('/admin').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.admin).toBe(true);
  });
});
