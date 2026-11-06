import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import type { AuthUserRecord } from '../../src/modules/auth/auth.types';
import type { TicketService } from '../../src/modules/tickets/tickets.service';
import type { TicketRecord } from '../../src/modules/tickets/tickets.types';
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

const DRIVER: AuthUserRecord = {
  ...CUSTOMER,
  ma_nguoi_dung: '3',
  ma_vai_tro: 4,
  ma_chi_nhanh: 1,
  ho_va_ten: 'Tài xế A',
  so_dien_thoai: '0912345678',
  email: null,
  ten_vai_tro: 'TAI_XE',
};

const TICKET: TicketRecord = {
  ma_ve: '501',
  ma_don_ve: '100',
  ma_dinh_danh_don: 'FUTA261021000001',
  ma_chuyen: 10,
  ma_ghe: 1,
  ky_hieu_ghe: 'A1',
  gia_ve: '320000.00',
  ma_qr_kiem_tra: 'FUTA1.token.signature',
  trang_thai_soat_ve: 'CHUA_LEN_XE',
  thoi_gian_soat_ve: null,
  tai_xe_soat_ve: null,
  trang_thai_ve: 'HIEU_LUC',
  ma_khach_hang: '7',
  ho_ten_khach: 'Khách A',
  so_dien_thoai_khach: '0901234567',
  email_khach: 'a@example.com',
  ma_chi_nhanh_ban: null,
  trang_thai_don: 'DA_THANH_TOAN',
  thoi_gian_tao: '2026-10-20T08:00:00.000Z',
  thoi_gian_xuat_ben: '2026-10-21T09:00:00.000Z',
  trang_thai_chuyen: 'SAP_CHAY',
  ma_tai_xe: '3',
  ten_tuyen: 'Sài Gòn - Đà Lạt',
  tinh_di: 'TP.HCM',
  tinh_den: 'Lâm Đồng',
  bien_so_xe: '51B-12345',
  ten_tai_xe: 'Tài xế A',
};

function buildApp(context: TestAuthContext, ticketService: TicketService) {
  return createApp({
    authService: context.authService,
    tokenService: context.tokenService,
    ticketService,
  });
}

function bearer(context: TestAuthContext, user: AuthUserRecord): string {
  return `Bearer ${context.tokenService.signAccessToken(user)}`;
}

describe('Tickets API', () => {
  let context: TestAuthContext;
  let app: Express;
  let service: {
    listMine: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    getQr: ReturnType<typeof vi.fn>;
    getQrPng: ReturnType<typeof vi.fn>;
    checkIn: ReturnType<typeof vi.fn>;
    listPassengers: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    context = buildTestAuth();
    service = {
      listMine: vi.fn(async () => ({
        items: [TICKET],
        meta: { page: 1, limit: 10, total: 1, total_pages: 1 },
      })),
      getById: vi.fn(async () => TICKET),
      getQr: vi.fn(async () => ({
        ve: TICKET,
        qr_token: TICKET.ma_qr_kiem_tra,
        qr_data_url: 'data:image/png;base64,AAAA',
      })),
      getQrPng: vi.fn(async () => ({ ticket: TICKET, buffer: Buffer.from('png') })),
      checkIn: vi.fn(async () => ({
        already_checked_in: false,
        ve: { ...TICKET, trang_thai_soat_ve: 'DA_LEN_XE', tai_xe_soat_ve: '3' },
      })),
      listPassengers: vi.fn(async () => ({
        chuyen_xe: { ma_chuyen: 10 },
        hanh_khach: [TICKET],
        tong_so_hanh_khach: 1,
        da_len_xe: 0,
        chua_len_xe: 1,
      })),
    };
    app = buildApp(context, service as unknown as TicketService);
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/v1/tickets/my');
    expect(response.status).toBe(401);
  });

  it('lists tickets of the current customer', async () => {
    const response = await request(app)
      .get('/api/v1/tickets/my?page=1&limit=10')
      .set('Authorization', bearer(context, CUSTOMER));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(service.listMine).toHaveBeenCalledWith(
      expect.objectContaining({ ma_nguoi_dung: '7' }),
      expect.objectContaining({ page: '1', limit: '10' }),
    );
  });

  it('returns ticket details for its owner', async () => {
    const response = await request(app)
      .get('/api/v1/tickets/501')
      .set('Authorization', bearer(context, CUSTOMER));

    expect(response.status).toBe(200);
    expect(response.body.data.ve.ma_ve).toBe('501');
  });

  it('returns QR code as a PNG image when requested', async () => {
    const response = await request(app)
      .get('/api/v1/tickets/501/qr?format=png')
      .set('Authorization', bearer(context, CUSTOMER));

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(service.getQrPng).toHaveBeenCalledWith('501', expect.anything());
  });

  it('lets a driver check in a ticket by QR token', async () => {
    const response = await request(app)
      .post('/api/v1/tickets/check-in')
      .set('Authorization', bearer(context, DRIVER))
      .send({ ma_qr: TICKET.ma_qr_kiem_tra });

    expect(response.status).toBe(200);
    expect(response.body.data.already_checked_in).toBe(false);
    expect(response.body.data.ve.trang_thai_soat_ve).toBe('DA_LEN_XE');
    expect(service.checkIn).toHaveBeenCalledWith(
      { ma_qr: TICKET.ma_qr_kiem_tra },
      expect.objectContaining({ ten_vai_tro: 'TAI_XE' }),
    );
  });

  it('forbids customers from checking in tickets', async () => {
    const response = await request(app)
      .post('/api/v1/tickets/check-in')
      .set('Authorization', bearer(context, CUSTOMER))
      .send({ ma_qr: TICKET.ma_qr_kiem_tra });

    expect(response.status).toBe(403);
    expect(service.checkIn).not.toHaveBeenCalled();
  });

  it('returns the passenger list for a trip', async () => {
    const response = await request(app)
      .get('/api/v1/tickets/trips/10/passengers')
      .set('Authorization', bearer(context, DRIVER));

    expect(response.status).toBe(200);
    expect(response.body.data.chuyen_xe.tong_so_hanh_khach).toBe(1);
    expect(service.listPassengers).toHaveBeenCalledWith('10', expect.anything());
  });
});
