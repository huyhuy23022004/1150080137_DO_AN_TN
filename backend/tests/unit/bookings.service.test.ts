import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/common/errors/AppError';
import { ERROR_CODES } from '../../src/common/errors/error-codes';
import { onSeatBooked, onSeatReleased } from '../../src/realtime/events';
import { BookingService } from '../../src/modules/bookings/bookings.service';
import type {
  BookingActor,
  BookingIdempotencyStorePort,
  BookingPaymentRecord,
  BookingRecord,
  BookingRepositoryPort,
  BookingSeatInfo,
  BookingTicketRecord,
  CreateBookingInput,
  CreatePaymentInput,
  CreateTicketInput,
  ExpiredBookingOrder,
} from '../../src/modules/bookings/bookings.types';
import type { SeatLockService } from '../../src/modules/seat-locks/seat-locks.service';

vi.mock('../../src/db/transaction', () => ({
  withTransaction: async <T>(work: (connection: object) => Promise<T>): Promise<T> => work({}),
}));

const NOW = new Date('2026-10-21T08:00:00.000Z');

const CUSTOMER_ACTOR: BookingActor = {
  ma_nguoi_dung: '7',
  ho_va_ten: 'Nguyễn Văn Khách',
  ten_vai_tro: 'KHACH_HANG',
  ma_chi_nhanh: null,
};

const STAFF_ACTOR: BookingActor = {
  ma_nguoi_dung: '3',
  ho_va_ten: 'Trần Thị Bán Vé',
  ten_vai_tro: 'NHAN_VIEN_PHONG_VE',
  ma_chi_nhanh: 1,
};

const BASE_INPUT: CreateBookingInput = {
  ma_chuyen: 10,
  danh_sach_ghe: ['A1', 'A2'],
  owner_ref: 'hold_client_12345',
  ma_diem_don: 1,
  ma_diem_tra: 2,
  ho_ten_khach: 'Lê Văn Khách',
  so_dien_thoai_khach: '0909999999',
};

interface HarnessOptions {
  failSecondTicketInsert?: boolean;
  bookedSeats?: string[];
  expiredOrders?: ExpiredBookingOrder[];
}

function createHarness(options: HarnessOptions = {}) {
  const orderInputs = new Map<string, Record<string, unknown>>();
  const tickets = new Map<string, BookingTicketRecord[]>();
  const payments = new Map<string, BookingPaymentRecord[]>();
  const idempotency = new Map<string, string>();
  const released: Array<{ ma_chuyen: number; danh_sach_ghe: string[] }> = [];
  let nextOrderId = 100;
  let ticketInsertCount = 0;
  let nextTicketId = 1;
  let nextPaymentId = 1;

  const seatRows: BookingSeatInfo[] = [
    { ma_ghe: 1, ky_hieu_ghe: 'A1', loai_cho: 'THUONG' },
    { ma_ghe: 2, ky_hieu_ghe: 'A2', loai_cho: 'THUONG' },
  ];

  function buildOrder(id: string): BookingRecord | null {
    const input = orderInputs.get(id);
    if (!input) {
      return null;
    }

    return {
      ma_don_ve: id,
      ma_dinh_danh_don: String(input.ma_dinh_danh_don),
      ma_chuyen: 10,
      ma_khach_hang: (input.ma_khach_hang as string | null) ?? null,
      ho_ten_khach: String(input.ho_ten_khach),
      so_dien_thoai_khach: String(input.so_dien_thoai_khach),
      email_khach: (input.email_khach as string | null) ?? null,
      ma_nhan_vien_ban: (input.ma_nhan_vien_ban as string | null) ?? null,
      ma_chi_nhanh_ban: (input.ma_chi_nhanh_ban as number | null) ?? null,
      ma_diem_don: Number(input.ma_diem_don),
      ma_diem_tra: Number(input.ma_diem_tra),
      tong_tien: String(input.tong_tien),
      trang_thai_don: String(input.trang_thai_don),
      thoi_gian_tao: NOW.toISOString(),
      chi_tiet_ve: tickets.get(id) ?? [],
      thanh_toan: payments.get(id) ?? [],
    };
  }

  const repository: BookingRepositoryPort = {
    list: vi.fn(async () => ({ items: [], total: 0 })),
    findTripForBooking: vi.fn(async () => ({
      ma_chuyen: 10,
      ma_tuyen: 1,
      ma_loai_xe: 1,
      gia_ve_co_ban: '320000.00',
      trang_thai: 'SAP_CHAY',
      thoi_gian_xuat_ben: '2026-10-21T12:00:00.000Z',
    })),
    findSeatsByCodes: vi.fn(async () => seatRows),
    findRouteStop: vi.fn(async (stopId: number) =>
      stopId === 1
        ? { ma_diem_dung: 1, ma_tuyen: 1, loai_diem: 'DON', thu_tu_dung: 1 }
        : { ma_diem_dung: 2, ma_tuyen: 1, loai_diem: 'TRA', thu_tu_dung: 2 },
    ),
    findBookedSeatCodes: vi.fn(async () => new Set(options.bookedSeats ?? [])),
    createOrder: vi.fn(async (input) => {
      const id = String(nextOrderId);
      nextOrderId += 1;
      orderInputs.set(id, { ...input });
      return id;
    }),
    createTickets: vi.fn(async (inputs: CreateTicketInput[]) => {
      ticketInsertCount += 1;
      if (options.failSecondTicketInsert && ticketInsertCount === 2) {
        throw Object.assign(
          new Error("Duplicate entry '1' for key 'chi_tiet_ve.uk_chuyen_ghe_hieu_luc'"),
          { code: 'ER_DUP_ENTRY' },
        );
      }

      const orderId = inputs[0]?.ma_don_ve;
      if (!orderId) {
        return;
      }

      const created = inputs.map((ticket) => ({
        ma_ve: String(nextTicketId++),
        ma_chuyen: ticket.ma_chuyen,
        ma_ghe: ticket.ma_ghe,
        ky_hieu_ghe: ticket.ky_hieu_ghe,
        gia_ve: ticket.gia_ve,
        ma_qr_kiem_tra: ticket.ma_qr_kiem_tra,
        trang_thai_soat_ve: 'CHUA_LEN_XE',
        trang_thai_ve: ticket.trang_thai_ve,
      }));
      tickets.set(orderId, created);
    }),
    createPayment: vi.fn(async (input: CreatePaymentInput) => {
      const id = String(nextPaymentId++);
      const list = payments.get(input.ma_don_ve) ?? [];
      list.push({
        ma_thanh_toan: id,
        phuong_thuc: input.phuong_thuc,
        ma_giao_dich_vnpay: null,
        so_tien: input.so_tien,
        trang_thai: input.trang_thai,
        thoi_gian_thanh_toan: NOW.toISOString(),
      });
      payments.set(input.ma_don_ve, list);
      return id;
    }),
    findOrderById: vi.fn(async (id: string) => buildOrder(id)),
    lockOrder: vi.fn(async (id: string) => buildOrder(id)),
    findOrderByIdentifier: vi.fn(async () => null),
    cancelOrder: vi.fn(async (id: string) => {
      const input = orderInputs.get(id);
      if (input) {
        input.trang_thai_don = 'DA_HUY';
      }

      const list = tickets.get(id) ?? [];
      tickets.set(
        id,
        list.map((ticket) => ({ ...ticket, trang_thai_ve: 'DA_HUY' })),
      );
    }),
    confirmCashPayment: vi.fn(async (id: string) => {
      const input = orderInputs.get(id);
      if (input) {
        input.trang_thai_don = 'DA_THANH_TOAN';
      }

      const list = payments.get(id) ?? [];
      payments.set(
        id,
        list.map((payment) => ({
          ...payment,
          trang_thai: 'THANH_CONG' as const,
          thoi_gian_thanh_toan: NOW.toISOString(),
        })),
      );
    }),
    findExpiredOrders: vi.fn(async () => options.expiredOrders ?? []),
  };

  const seatLocks = {
    verifyForBooking: vi.fn(async () => undefined),
    consumeAfterBooking: vi.fn(async () => undefined),
    getActiveSeatCodes: vi.fn(async () => new Set<string>()),
  } as unknown as SeatLockService;

  const idempotencyStore: BookingIdempotencyStorePort = {
    get: vi.fn(async (key: string) => idempotency.get(key) ?? null),
    set: vi.fn(async (key: string, orderId: string) => {
      idempotency.set(key, orderId);
    }),
    delete: vi.fn(async (key: string) => {
      idempotency.delete(key);
    }),
  };

  const service = new BookingService({
    repository,
    seatLocks,
    orderCodeGenerator: {
      next: vi.fn(async () => `FUTA261021${String(nextOrderId).padStart(6, '0')}`),
    },
    idempotencyStore,
    customerProfiles: {
      findUserById: vi.fn(async () => ({
        ho_va_ten: 'Nguyễn Văn Khách',
        so_dien_thoai: '0901234567',
        email: 'khach@example.com',
      })),
    },
    now: () => NOW,
  });

  return {
    service,
    repository,
    seatLocks,
    idempotencyStore,
    released,
  };
}

describe('BookingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tạo đơn tiền mặt tại quầy ở trạng thái đã thanh toán', async () => {
    const harness = createHarness();
    const bookedEvents: string[] = [];
    const unsubscribe = onSeatBooked((event) => bookedEvents.push(event.ma_don_ve));

    const result = await harness.service.create(BASE_INPUT, STAFF_ACTOR);

    expect(result.trang_thai_don).toBe('DA_THANH_TOAN');
    expect(result.thoi_gian_het_han).toBeNull();
    expect(result.tong_tien).toBe('640000.00');
    expect(result.chi_tiet_ve).toHaveLength(2);
    expect(result.chi_tiet_ve.every((ticket) => ticket.ma_qr_kiem_tra.startsWith('FUTA1.'))).toBe(
      true,
    );
    expect(result.thanh_toan[0]?.phuong_thuc).toBe('TIEN_MAT');
    expect(result.thanh_toan[0]?.trang_thai).toBe('THANH_CONG');
    expect(harness.seatLocks.verifyForBooking).toHaveBeenCalledWith(
      10,
      ['A1', 'A2'],
      'hold_client_12345',
    );
    expect(harness.seatLocks.consumeAfterBooking).toHaveBeenCalledWith(
      10,
      ['A1', 'A2'],
      'hold_client_12345',
    );
    expect(bookedEvents).toEqual([result.ma_don_ve]);

    unsubscribe();
  });

  it('tạo đơn khách hàng chờ thanh toán kèm hạn giữ đơn', async () => {
    const harness = createHarness();
    const result = await harness.service.create(BASE_INPUT, CUSTOMER_ACTOR);

    expect(result.trang_thai_don).toBe('CHO_THANH_TOAN');
    expect(result.ma_khach_hang).toBe('7');
    expect(result.ma_nhan_vien_ban).toBeNull();
    expect(result.thanh_toan[0]?.trang_thai).toBe('CHO_XU_LY');
    expect(result.thoi_gian_het_han).toBe('2026-10-21T08:15:00.000Z');
  });

  it('tạo đơn VNPAY chờ thanh toán cho khách hàng', async () => {
    const harness = createHarness();
    const result = await harness.service.create(
      { ...BASE_INPUT, phuong_thuc_thanh_toan: 'VNPAY' },
      CUSTOMER_ACTOR,
    );

    expect(result.trang_thai_don).toBe('CHO_THANH_TOAN');
    expect(result.thanh_toan[0]?.phuong_thuc).toBe('VNPAY');
    expect(result.thanh_toan[0]?.trang_thai).toBe('CHO_XU_LY');
    expect(result.thoi_gian_het_han).toBe('2026-10-21T08:15:00.000Z');
  });

  it('không đánh dấu đơn VNPAY là đã thanh toán khi nhân viên tạo', async () => {
    const harness = createHarness();
    const result = await harness.service.create(
      { ...BASE_INPUT, phuong_thuc_thanh_toan: 'VNPAY' },
      STAFF_ACTOR,
    );

    expect(result.trang_thai_don).toBe('CHO_THANH_TOAN');
    expect(result.thanh_toan[0]?.trang_thai).toBe('CHO_XU_LY');
    expect(harness.seatLocks.consumeAfterBooking).toHaveBeenCalledWith(
      10,
      ['A1', 'A2'],
      'hold_client_12345',
    );
  });

  it('trả lại đơn cũ khi dùng lại Idempotency-Key', async () => {
    const harness = createHarness();
    const input = { ...BASE_INPUT, idempotency_key: 'request-0001' };

    const first = await harness.service.create(input, CUSTOMER_ACTOR);
    const second = await harness.service.create(input, CUSTOMER_ACTOR);

    expect(second.ma_don_ve).toBe(first.ma_don_ve);
    expect(harness.repository.createOrder).toHaveBeenCalledTimes(1);
    expect(harness.seatLocks.verifyForBooking).toHaveBeenCalledTimes(1);
  });

  it('báo lỗi khi Idempotency-Key được dùng cho ghế khác', async () => {
    const harness = createHarness();
    const input = { ...BASE_INPUT, idempotency_key: 'request-0002' };

    await harness.service.create(input, CUSTOMER_ACTOR);

    await expect(
      harness.service.create({ ...input, danh_sach_ghe: ['A1'] }, CUSTOMER_ACTOR),
    ).rejects.toMatchObject({
      code: ERROR_CODES.BOOKING_IDEMPOTENCY_CONFLICT,
    });
  });

  it('chặn ghế đã bán trong cơ sở dữ liệu', async () => {
    const harness = createHarness({ bookedSeats: ['A2'] });

    await expect(harness.service.create(BASE_INPUT, CUSTOMER_ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.BOOKING_SEAT_CONFLICT,
      details: { danh_sach_ghe: ['A2'] },
    });

    expect(harness.seatLocks.consumeAfterBooking).not.toHaveBeenCalled();
  });

  it('chỉ một trong hai đơn đồng thời giành cùng ghế thành công', async () => {
    const harness = createHarness({ failSecondTicketInsert: true });

    const results = await Promise.allSettled([
      harness.service.create(BASE_INPUT, CUSTOMER_ACTOR),
      harness.service.create(BASE_INPUT, CUSTOMER_ACTOR),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0]?.reason as AppError).code).toBe(ERROR_CODES.BOOKING_SEAT_CONFLICT);
  });

  it('hủy đơn chờ thanh toán và phát sự kiện nhả ghế', async () => {
    const harness = createHarness();
    const order = await harness.service.create(BASE_INPUT, CUSTOMER_ACTOR);
    const released: string[] = [];
    const unsubscribe = onSeatReleased((event) => released.push(event.reason));

    const cancelled = await harness.service.cancel(order.ma_don_ve, CUSTOMER_ACTOR);

    expect(cancelled.trang_thai_don).toBe('DA_HUY');
    expect(cancelled.chi_tiet_ve.every((ticket) => ticket.trang_thai_ve === 'DA_HUY')).toBe(true);
    expect(released).toEqual(['CANCELLED']);

    unsubscribe();
  });

  it('nhân viên xác nhận thanh toán tiền mặt cho đơn đang chờ', async () => {
    const harness = createHarness();
    const order = await harness.service.create(BASE_INPUT, CUSTOMER_ACTOR);

    const confirmed = await harness.service.confirmCash(order.ma_don_ve, STAFF_ACTOR);

    expect(confirmed.trang_thai_don).toBe('DA_THANH_TOAN');
    expect(confirmed.thanh_toan[0]?.trang_thai).toBe('THANH_CONG');
    expect(confirmed.thoi_gian_het_han).toBeNull();
  });

  it('tự hủy đơn quá hạn thanh toán', async () => {
    const harness = createHarness();
    const order = await harness.service.create(BASE_INPUT, CUSTOMER_ACTOR);

    harness.repository.findExpiredOrders = vi.fn(async () => [
      {
        ma_don_ve: order.ma_don_ve,
        ma_chuyen: 10,
        danh_sach_ghe: ['A1', 'A2'],
      },
    ]);

    const expired = await harness.service.expirePendingOrders();

    expect(expired).toHaveLength(1);
    const stored = await harness.repository.findOrderById(order.ma_don_ve);
    expect(stored?.trang_thai_don).toBe('DA_HUY');
  });

  it('báo giá ghế kèm trạng thái đang giữ', async () => {
    const harness = createHarness({ bookedSeats: ['A2'] });
    harness.seatLocks.getActiveSeatCodes = vi.fn(async () => new Set(['A1']));

    const quote = await harness.service.quote(10, ['A1', 'A2']);

    expect(quote.danh_sach_ghe).toEqual([
      {
        ky_hieu_ghe: 'A1',
        loai_cho: 'THUONG',
        gia_ve: '320000.00',
        trang_thai: 'DANG_GIU',
      },
      {
        ky_hieu_ghe: 'A2',
        loai_cho: 'THUONG',
        gia_ve: '320000.00',
        trang_thai: 'DA_DAT',
      },
    ]);
    expect(quote.so_ghe_trong).toBe(0);
    expect(quote.tong_tien).toBe('640000.00');
  });
});
