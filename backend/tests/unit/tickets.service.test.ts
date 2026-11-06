import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '../../src/common/errors/error-codes';
import { TicketService } from '../../src/modules/tickets/tickets.service';
import type {
  PassengerRecord,
  TicketRecord,
  TicketRepositoryPort,
} from '../../src/modules/tickets/tickets.types';
import { createTicketQrToken } from '../../src/utils/qr-token';

vi.mock('../../src/db/transaction', () => ({
  withTransaction: async <T>(work: (connection: object) => Promise<T>): Promise<T> => work({}),
}));

const NOW = new Date('2026-10-21T08:00:00.000Z');
const DEPARTURE = '2026-10-21T09:00:00.000Z';

const DRIVER = {
  ma_nguoi_dung: '3',
  ho_va_ten: 'Tài xế A',
  ten_vai_tro: 'TAI_XE' as const,
  ma_chi_nhanh: 1,
};

const OTHER_DRIVER = {
  ma_nguoi_dung: '4',
  ho_va_ten: 'Tài xế B',
  ten_vai_tro: 'TAI_XE' as const,
  ma_chi_nhanh: 1,
};

const CUSTOMER = {
  ma_nguoi_dung: '7',
  ho_va_ten: 'Khách A',
  ten_vai_tro: 'KHACH_HANG' as const,
  ma_chi_nhanh: null,
};

interface HarnessOptions {
  orderStatus?: string;
  ticketStatus?: string;
  tripStatus?: string;
}

function createHarness(options: HarnessOptions = {}) {
  const token = createTicketQrToken({ ma_chuyen: 10, ky_hieu_ghe: 'A1' });

  const state = {
    orderStatus: options.orderStatus ?? 'DA_THANH_TOAN',
    ticketStatus: options.ticketStatus ?? 'CHUA_LEN_XE',
  };

  function currentTicket(): TicketRecord {
    return {
      ma_ve: '501',
      ma_don_ve: '100',
      ma_dinh_danh_don: 'FUTA261021000001',
      ma_chuyen: 10,
      ma_ghe: 1,
      ky_hieu_ghe: 'A1',
      gia_ve: '320000.00',
      ma_qr_kiem_tra: token,
      trang_thai_soat_ve: state.ticketStatus,
      thoi_gian_soat_ve: state.ticketStatus === 'DA_LEN_XE' ? NOW.toISOString() : null,
      tai_xe_soat_ve: state.ticketStatus === 'DA_LEN_XE' ? DRIVER.ma_nguoi_dung : null,
      trang_thai_ve: 'HIEU_LUC',
      ma_khach_hang: '7',
      ho_ten_khach: 'Khách A',
      so_dien_thoai_khach: '0901234567',
      email_khach: 'khach@example.com',
      ma_chi_nhanh_ban: null,
      trang_thai_don: state.orderStatus,
      thoi_gian_tao: NOW.toISOString(),
      thoi_gian_xuat_ben: DEPARTURE,
      trang_thai_chuyen: options.tripStatus ?? 'SAP_CHAY',
      ma_tai_xe: DRIVER.ma_nguoi_dung,
      ten_tuyen: 'Sài Gòn - Đà Lạt',
      tinh_di: 'TP.HCM',
      tinh_den: 'Lâm Đồng',
      bien_so_xe: '51B-12345',
      ten_tai_xe: DRIVER.ho_va_ten,
    };
  }

  const passengers: PassengerRecord[] = [
    {
      ma_ve: '501',
      ma_don_ve: '100',
      ma_dinh_danh_don: 'FUTA261021000001',
      ky_hieu_ghe: 'A1',
      ho_ten_khach: 'Khách A',
      so_dien_thoai_khach: '0901234567',
      email_khach: 'khach@example.com',
      trang_thai_soat_ve: state.ticketStatus,
      thoi_gian_soat_ve: null,
    },
    {
      ma_ve: '502',
      ma_don_ve: '101',
      ma_dinh_danh_don: 'FUTA261021000002',
      ky_hieu_ghe: 'A2',
      ho_ten_khach: 'Khách B',
      so_dien_thoai_khach: '0907654321',
      email_khach: null,
      trang_thai_soat_ve: 'CHUA_LEN_XE',
      thoi_gian_soat_ve: null,
    },
  ];

  const repository: TicketRepositoryPort = {
    listByCustomer: vi.fn(async () => ({ items: [currentTicket()], total: 1 })),
    findById: vi.fn(async () => currentTicket()),
    findByToken: vi.fn(async (value: string) => (value === token ? currentTicket() : null)),
    updateCheckin: vi.fn(async () => {
      state.ticketStatus = 'DA_LEN_XE';
      return true;
    }),
    findTripAssignment: vi.fn(async () => ({
      ma_chuyen: 10,
      ma_tai_xe: DRIVER.ma_nguoi_dung,
      thoi_gian_xuat_ben: DEPARTURE,
      trang_thai: 'SAP_CHAY',
      ma_chi_nhanh_tai_xe: 1,
    })),
    listPassengersByTrip: vi.fn(async () => [
      { ...passengers[0]!, trang_thai_soat_ve: state.ticketStatus },
      passengers[1]!,
    ]),
  };

  const service = new TicketService({
    repository,
    now: () => NOW,
    checkinOpenHoursBefore: 24,
    checkinCloseHoursAfter: 2,
  });

  return { service, repository, state, token };
}

describe('TicketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists the current customer tickets', async () => {
    const harness = createHarness();
    const result = await harness.service.listMine(CUSTOMER, { page: 1, limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(harness.repository.listByCustomer).toHaveBeenCalledWith(
      '7',
      expect.objectContaining({ pagination: { page: 1, limit: 10, offset: 0 } }),
    );
  });

  it('only lets the ticket owner read ticket details', async () => {
    const harness = createHarness();

    const ticket = await harness.service.getById('501', CUSTOMER);
    expect(ticket.ma_ve).toBe('501');

    await expect(
      harness.service.getById('501', { ...CUSTOMER, ma_nguoi_dung: '8' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.FORBIDDEN });
  });

  it('renders the QR code as a PNG data URL', async () => {
    const harness = createHarness();
    const result = await harness.service.getQr('501', CUSTOMER);

    expect(result.qr_token).toBe(harness.token);
    expect(result.qr_data_url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('checks in a paid ticket assigned to the driver', async () => {
    const harness = createHarness();
    const result = await harness.service.checkIn({ ma_qr: harness.token }, DRIVER);

    expect(result.already_checked_in).toBe(false);
    expect(result.ve.trang_thai_soat_ve).toBe('DA_LEN_XE');
    expect(result.ve.tai_xe_soat_ve).toBe(DRIVER.ma_nguoi_dung);
    expect(harness.repository.updateCheckin).toHaveBeenCalledWith(
      '501',
      DRIVER.ma_nguoi_dung,
      expect.anything(),
    );
  });

  it('returns already_checked_in when the QR is scanned twice', async () => {
    const harness = createHarness();

    const first = await harness.service.checkIn({ ma_qr: harness.token }, DRIVER);
    const second = await harness.service.checkIn({ ma_qr: harness.token }, DRIVER);

    expect(first.already_checked_in).toBe(false);
    expect(second.already_checked_in).toBe(true);
    expect(harness.repository.updateCheckin).toHaveBeenCalledTimes(1);
  });

  it('rejects a forged QR token', async () => {
    const harness = createHarness();

    await expect(
      harness.service.checkIn({ ma_qr: 'FUTA1.fake.signature' }, DRIVER),
    ).rejects.toMatchObject({ code: ERROR_CODES.TICKET_INVALID_QR });
  });

  it('rejects a ticket for another trip or driver', async () => {
    const harness = createHarness();

    await expect(
      harness.service.checkIn({ ma_qr: harness.token }, OTHER_DRIVER),
    ).rejects.toMatchObject({ code: ERROR_CODES.TICKET_WRONG_TRIP });
  });

  it('rejects an unpaid order', async () => {
    const harness = createHarness({ orderStatus: 'CHO_THANH_TOAN' });

    await expect(harness.service.checkIn({ ma_qr: harness.token }, DRIVER)).rejects.toMatchObject({
      code: ERROR_CODES.TICKET_NOT_PAID,
    });
  });

  it('rejects check-in outside the allowed time window', async () => {
    const harness = createHarness();
    const service = new TicketService({
      repository: harness.repository,
      now: () => new Date('2026-10-19T08:00:00.000Z'),
      checkinOpenHoursBefore: 24,
      checkinCloseHoursAfter: 2,
    });

    await expect(service.checkIn({ ma_qr: harness.token }, DRIVER)).rejects.toMatchObject({
      code: ERROR_CODES.TICKET_CHECKIN_NOT_OPEN,
    });
  });

  it('lists passengers and check-in counters for the assigned driver', async () => {
    const harness = createHarness();

    const result = await harness.service.listPassengers(10, DRIVER);

    expect(result.tong_so_hanh_khach).toBe(2);
    expect(result.da_len_xe).toBe(0);
    expect(result.chua_len_xe).toBe(2);

    await expect(harness.service.listPassengers(10, OTHER_DRIVER)).rejects.toMatchObject({
      code: ERROR_CODES.FORBIDDEN,
    });
  });
});
