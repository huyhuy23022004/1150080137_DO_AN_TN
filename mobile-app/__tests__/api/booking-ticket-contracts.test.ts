import { apiClient } from '../../src/api/client';
import { bookingsApi } from '../../src/api/endpoints/bookings';
import { paymentsApi } from '../../src/api/endpoints/payments';
import { ticketsApi } from '../../src/api/endpoints/tickets';
import type { BookingOrder, BookingQuote } from '../../src/types/booking';
import type { CheckinResult, Ticket, TicketQr, TripPassengers } from '../../src/types/ticket';

jest.mock('../../src/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedClient = apiClient as unknown as {
  get: jest.Mock;
  post: jest.Mock;
};

const quote: BookingQuote = {
  ma_chuyen: 12,
  danh_sach_ghe: [
    {
      ky_hieu_ghe: 'A01',
      loai_cho: 'THUONG',
      gia_ve: '150000',
      trang_thai: 'TRONG',
    },
  ],
  so_ghe_trong: 20,
  tong_tien: '150000',
  tien_te: 'VND',
};

const booking: BookingOrder = {
  ma_don_ve: 'DON001',
  ma_dinh_danh_don: 'FUTA001',
  ma_chuyen: 12,
  ma_khach_hang: 'ND001',
  ho_ten_khach: 'Nguyễn Văn An',
  so_dien_thoai_khach: '0901234567',
  email_khach: null,
  ma_nhan_vien_ban: null,
  ma_chi_nhanh_ban: null,
  ma_diem_don: 1,
  ma_diem_tra: 2,
  tong_tien: '150000',
  trang_thai_don: 'CHO_THANH_TOAN',
  thoi_gian_tao: '2026-10-24T01:00:00.000Z',
  chi_tiet_ve: [],
  thanh_toan: [],
  thoi_gian_het_han: '2026-10-24T01:10:00.000Z',
};

const ticket = {
  ma_ve: 'VE001',
  ma_qr_kiem_tra: 'qr-token',
} as Ticket;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('booking API contracts', () => {
  it('unwraps the quote returned by the backend', async () => {
    mockedClient.post.mockResolvedValue({ data: { data: { bao_gia: quote } } });

    await expect(bookingsApi.quote(12, ['A01'])).resolves.toEqual(quote);
    expect(mockedClient.post).toHaveBeenCalledWith('/bookings/quote', {
      ma_chuyen: 12,
      danh_sach_ghe: ['A01'],
    });
  });

  it('sends the idempotency key in both header and body', async () => {
    mockedClient.post.mockResolvedValue({
      data: { data: { don_dat_ve: booking, payment_url: 'https://vnpay.test' } },
    });

    const result = await bookingsApi.create(
      {
        ma_chuyen: 12,
        danh_sach_ghe: ['A01'],
        owner_ref: 'owner-12345',
        ma_diem_don: 1,
        ma_diem_tra: 2,
        phuong_thuc_thanh_toan: 'VNPAY',
      },
      'idem-123',
    );

    expect(result.don_dat_ve.ma_don_ve).toBe('DON001');
    expect(mockedClient.post).toHaveBeenCalledWith(
      '/bookings',
      expect.objectContaining({ idempotency_key: 'idem-123' }),
      { headers: { 'Idempotency-Key': 'idem-123' } },
    );
  });

  it('unwraps booking detail', async () => {
    mockedClient.get.mockResolvedValue({ data: { data: { don_dat_ve: booking } } });

    await expect(bookingsApi.getById('DON001')).resolves.toEqual(booking);
  });
});

describe('payment and ticket API contracts', () => {
  it('unwraps the VNPAY payment URL', async () => {
    const payment = {
      ma_don_ve: 'DON001',
      ma_dinh_danh_don: 'FUTA001',
      so_tien: '150000',
      payment_url: 'https://sandbox.vnpayment.vn/pay',
      het_han_thanh_toan: '2026-10-24T01:10:00.000Z',
    };
    mockedClient.post.mockResolvedValue({ data: { data: { thanh_toan: payment } } });

    await expect(paymentsApi.createVnpayUrl('DON001')).resolves.toEqual(payment);
  });

  it('unwraps the QR payload', async () => {
    const qr: TicketQr = {
      ma_ve: 'VE001',
      ma_qr_kiem_tra: 'qr-token',
      dinh_dang: 'png',
      qr_data_url: 'data:image/png;base64,abc',
    };
    mockedClient.get.mockResolvedValue({ data: { data: qr } });

    await expect(ticketsApi.getQr('VE001')).resolves.toEqual(qr);
  });

  it('unwraps the passenger list', async () => {
    const passengers: TripPassengers = {
      ma_chuyen: 12,
      thoi_gian_xuat_ben: '2026-10-24T01:00:00.000Z',
      tong_so_hanh_khach: 1,
      da_len_xe: 0,
      chua_len_xe: 1,
      danh_sach: [],
    };
    mockedClient.get.mockResolvedValue({ data: { data: { chuyen_xe: passengers } } });

    await expect(ticketsApi.listPassengers(12)).resolves.toEqual(passengers);
  });

  it('returns check-in state for an already scanned ticket', async () => {
    const checkin: CheckinResult = { already_checked_in: true, ve: ticket };
    mockedClient.post.mockResolvedValue({ data: { data: checkin } });

    await expect(ticketsApi.checkIn('qr-token')).resolves.toEqual(checkin);
    expect(mockedClient.post).toHaveBeenCalledWith('/tickets/check-in', {
      ma_qr: 'qr-token',
    });
  });
});
