import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import type { PaymentMethod, PaymentStatus } from '../../common/constants';
import type { DbExecutor } from '../../db/types';
import { toIsoUtc } from '../../utils/datetime';
import type {
  BookingListFilters,
  BookingListRecord,
  BookingPaymentRecord,
  BookingRecord,
  BookingRepositoryPort,
  BookingSeatInfo,
  BookingStopInfo,
  BookingTicketRecord,
  BookingTripInfo,
  CreateOrderInput,
  CreatePaymentInput,
  CreateTicketInput,
  ExpiredBookingOrder,
} from './bookings.types';

interface TripRow extends RowDataPacket {
  ma_chuyen: number;
  ma_tuyen: number;
  ma_loai_xe: number;
  gia_ve_co_ban: string;
  trang_thai: string;
  thoi_gian_xuat_ben: string;
}

interface SeatRow extends RowDataPacket {
  ma_ghe: number;
  ky_hieu_ghe: string;
  loai_cho: string;
}

interface StopRow extends RowDataPacket {
  ma_diem_dung: number;
  ma_tuyen: number;
  loai_diem: string;
  thu_tu_dung: number;
}

interface SeatCodeRow extends RowDataPacket {
  ky_hieu_ghe: string;
}

interface OrderRow extends RowDataPacket {
  ma_don_ve: string | number;
  ma_dinh_danh_don: string;
  ma_khach_hang: string | number | null;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  ma_nhan_vien_ban: string | number | null;
  ma_chi_nhanh_ban: number | null;
  ma_diem_don: number;
  ma_diem_tra: number;
  tong_tien: string;
  trang_thai_don: string;
  thoi_gian_tao: string;
}

interface TicketRow extends RowDataPacket {
  ma_ve: string | number;
  ma_chuyen: number;
  ma_ghe: number;
  ky_hieu_ghe: string;
  gia_ve: string;
  ma_qr_kiem_tra: string;
  trang_thai_soat_ve: string;
  trang_thai_ve: string;
}

interface PaymentRow extends RowDataPacket {
  ma_thanh_toan: string | number;
  phuong_thuc: string;
  ma_giao_dich_vnpay: string | null;
  so_tien: string;
  trang_thai: string;
  thoi_gian_thanh_toan: string | null;
}

interface ExpiredOrderRow extends RowDataPacket {
  ma_don_ve: string | number;
  ma_chuyen: number;
  ky_hieu_ghe: string;
}

interface CountRow extends RowDataPacket {
  total: string | number;
}

interface OrderListRow extends OrderRow {
  ten_chi_nhanh: string | null;
  phuong_thuc_thanh_toan: string | null;
  trang_thai_thanh_toan: string | null;
}

interface OrderTripRow extends RowDataPacket {
  ma_don_ve: string | number;
  ky_hieu_ghe: string;
  ma_chuyen: number;
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  thoi_gian_xuat_ben: string;
}

const ORDER_COLUMNS = `
  \`ma_don_ve\`, \`ma_dinh_danh_don\`, \`ma_khach_hang\`, \`ho_ten_khach\`,
  \`so_dien_thoai_khach\`, \`email_khach\`, \`ma_nhan_vien_ban\`, \`ma_chi_nhanh_ban\`,
  \`ma_diem_don\`, \`ma_diem_tra\`, \`tong_tien\`, \`trang_thai_don\`, \`thoi_gian_tao\`
`;

const ORDER_LIST_COLUMNS = `
  d.\`ma_don_ve\`, d.\`ma_dinh_danh_don\`, d.\`ma_khach_hang\`, d.\`ho_ten_khach\`,
  d.\`so_dien_thoai_khach\`, d.\`email_khach\`, d.\`ma_nhan_vien_ban\`,
  d.\`ma_chi_nhanh_ban\`, d.\`ma_diem_don\`, d.\`ma_diem_tra\`, d.\`tong_tien\`,
  d.\`trang_thai_don\`, d.\`thoi_gian_tao\`, b.\`ten_chi_nhanh\`,
  (
    SELECT p.\`phuong_thuc\` FROM \`thanh_toan\` p
    WHERE p.\`ma_don_ve\` = d.\`ma_don_ve\`
    ORDER BY p.\`ma_thanh_toan\` ASC LIMIT 1
  ) AS \`phuong_thuc_thanh_toan\`,
  (
    SELECT p.\`trang_thai\` FROM \`thanh_toan\` p
    WHERE p.\`ma_don_ve\` = d.\`ma_don_ve\`
    ORDER BY p.\`ma_thanh_toan\` ASC LIMIT 1
  ) AS \`trang_thai_thanh_toan\`
`;

function mapTrip(row: TripRow): BookingTripInfo {
  return {
    ma_chuyen: Number(row.ma_chuyen),
    ma_tuyen: Number(row.ma_tuyen),
    ma_loai_xe: Number(row.ma_loai_xe),
    gia_ve_co_ban: String(row.gia_ve_co_ban),
    trang_thai: String(row.trang_thai),
    thoi_gian_xuat_ben: toIsoUtc(row.thoi_gian_xuat_ben) ?? String(row.thoi_gian_xuat_ben),
  };
}

function mapSeat(row: SeatRow): BookingSeatInfo {
  return {
    ma_ghe: Number(row.ma_ghe),
    ky_hieu_ghe: String(row.ky_hieu_ghe),
    loai_cho: String(row.loai_cho),
  };
}

function mapStop(row: StopRow): BookingStopInfo {
  return {
    ma_diem_dung: Number(row.ma_diem_dung),
    ma_tuyen: Number(row.ma_tuyen),
    loai_diem: String(row.loai_diem),
    thu_tu_dung: Number(row.thu_tu_dung),
  };
}

function mapTicket(row: TicketRow): BookingTicketRecord {
  return {
    ma_ve: String(row.ma_ve),
    ma_chuyen: Number(row.ma_chuyen),
    ma_ghe: Number(row.ma_ghe),
    ky_hieu_ghe: String(row.ky_hieu_ghe),
    gia_ve: String(row.gia_ve),
    ma_qr_kiem_tra: String(row.ma_qr_kiem_tra),
    trang_thai_soat_ve: String(row.trang_thai_soat_ve),
    trang_thai_ve: String(row.trang_thai_ve),
  };
}

function mapPayment(row: PaymentRow): BookingPaymentRecord {
  return {
    ma_thanh_toan: String(row.ma_thanh_toan),
    phuong_thuc: String(row.phuong_thuc) as PaymentMethod,
    ma_giao_dich_vnpay: row.ma_giao_dich_vnpay === null ? null : String(row.ma_giao_dich_vnpay),
    so_tien: String(row.so_tien),
    trang_thai: String(row.trang_thai) as PaymentStatus,
    thoi_gian_thanh_toan: toIsoUtc(row.thoi_gian_thanh_toan),
  };
}

function mapOrder(
  row: OrderRow,
  tickets: BookingTicketRecord[],
  payments: BookingPaymentRecord[],
): BookingRecord {
  return {
    ma_don_ve: String(row.ma_don_ve),
    ma_dinh_danh_don: String(row.ma_dinh_danh_don),
    ma_chuyen: tickets[0]?.ma_chuyen ?? null,
    ma_khach_hang: row.ma_khach_hang === null ? null : String(row.ma_khach_hang),
    ho_ten_khach: String(row.ho_ten_khach),
    so_dien_thoai_khach: String(row.so_dien_thoai_khach),
    email_khach: row.email_khach === null ? null : String(row.email_khach),
    ma_nhan_vien_ban: row.ma_nhan_vien_ban === null ? null : String(row.ma_nhan_vien_ban),
    ma_chi_nhanh_ban: row.ma_chi_nhanh_ban === null ? null : Number(row.ma_chi_nhanh_ban),
    ma_diem_don: Number(row.ma_diem_don),
    ma_diem_tra: Number(row.ma_diem_tra),
    tong_tien: String(row.tong_tien),
    trang_thai_don: String(row.trang_thai_don),
    thoi_gian_tao: toIsoUtc(row.thoi_gian_tao) ?? String(row.thoi_gian_tao),
    chi_tiet_ve: tickets,
    thanh_toan: payments,
  };
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

function mapOrderList(
  row: OrderListRow,
  trip: OrderTripRow | undefined,
  seatCodes: string[],
): BookingListRecord {
  return {
    ma_don_ve: String(row.ma_don_ve),
    ma_dinh_danh_don: String(row.ma_dinh_danh_don),
    ma_khach_hang: row.ma_khach_hang === null ? null : String(row.ma_khach_hang),
    ho_ten_khach: String(row.ho_ten_khach),
    so_dien_thoai_khach: String(row.so_dien_thoai_khach),
    email_khach: row.email_khach === null ? null : String(row.email_khach),
    ma_nhan_vien_ban: row.ma_nhan_vien_ban === null ? null : String(row.ma_nhan_vien_ban),
    ma_chi_nhanh_ban: row.ma_chi_nhanh_ban === null ? null : Number(row.ma_chi_nhanh_ban),
    ten_chi_nhanh: row.ten_chi_nhanh === null ? null : String(row.ten_chi_nhanh),
    ma_diem_don: Number(row.ma_diem_don),
    ma_diem_tra: Number(row.ma_diem_tra),
    tong_tien: String(row.tong_tien),
    trang_thai_don: String(row.trang_thai_don),
    thoi_gian_tao: toIsoUtc(row.thoi_gian_tao) ?? String(row.thoi_gian_tao),
    ma_chuyen: trip ? Number(trip.ma_chuyen) : null,
    ma_tuyen: trip ? Number(trip.ma_tuyen) : null,
    ten_tuyen: trip ? String(trip.ten_tuyen) : null,
    tinh_di: trip ? String(trip.tinh_di) : null,
    tinh_den: trip ? String(trip.tinh_den) : null,
    thoi_gian_xuat_ben: trip
      ? (toIsoUtc(trip.thoi_gian_xuat_ben) ?? String(trip.thoi_gian_xuat_ben))
      : null,
    danh_sach_ghe: seatCodes,
    so_ve: seatCodes.length,
    phuong_thuc_thanh_toan:
      row.phuong_thuc_thanh_toan === null
        ? null
        : (String(row.phuong_thuc_thanh_toan) as PaymentMethod),
    trang_thai_thanh_toan:
      row.trang_thai_thanh_toan === null
        ? null
        : (String(row.trang_thai_thanh_toan) as PaymentStatus),
  };
}

export class BookingRepository implements BookingRepositoryPort {
  public async list(
    filters: BookingListFilters,
  ): Promise<{ items: BookingListRecord[]; total: number }> {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.q) {
      where.push('(d.`ma_dinh_danh_don` LIKE ? OR d.`so_dien_thoai_khach` LIKE ?)');
      const pattern = likePattern(filters.q);
      params.push(pattern, pattern);
    }

    if (filters.ma_dinh_danh_don) {
      where.push('d.`ma_dinh_danh_don` LIKE ?');
      params.push(likePattern(filters.ma_dinh_danh_don));
    }

    if (filters.so_dien_thoai_khach) {
      where.push('d.`so_dien_thoai_khach` LIKE ?');
      params.push(likePattern(filters.so_dien_thoai_khach));
    }

    if (filters.ma_chuyen !== null) {
      where.push(
        `EXISTS (
          SELECT 1 FROM \`chi_tiet_ve\` ct
          WHERE ct.\`ma_don_ve\` = d.\`ma_don_ve\` AND ct.\`ma_chuyen\` = ?
        )`,
      );
      params.push(filters.ma_chuyen);
    }

    if (filters.trang_thai_don) {
      where.push('d.`trang_thai_don` = ?');
      params.push(filters.trang_thai_don);
    }

    if (filters.ma_chi_nhanh !== null) {
      where.push(
        filters.include_unassigned_branch
          ? '(d.`ma_chi_nhanh_ban` = ? OR d.`ma_chi_nhanh_ban` IS NULL)'
          : 'd.`ma_chi_nhanh_ban` = ?',
      );
      params.push(filters.ma_chi_nhanh);
    }

    if (filters.start_utc) {
      where.push('d.`thoi_gian_tao` >= ?');
      params.push(filters.start_utc);
    }

    if (filters.end_utc) {
      where.push('d.`thoi_gian_tao` < ?');
      params.push(filters.end_utc);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM \`don_dat_ve\` d ${whereSql}`,
      params,
    );

    const [rows] = await pool.execute<OrderListRow[]>(
      `SELECT ${ORDER_LIST_COLUMNS}
       FROM \`don_dat_ve\` d
       LEFT JOIN \`chi_nhanh\` b ON b.\`ma_chi_nhanh\` = d.\`ma_chi_nhanh_ban\`
       ${whereSql}
       ORDER BY d.\`thoi_gian_tao\` DESC, d.\`ma_don_ve\` DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.pagination.limit, filters.pagination.offset],
    );

    const orderIds = rows.map((row) => String(row.ma_don_ve));
    const tripByOrder = new Map<string, OrderTripRow>();
    const seatsByOrder = new Map<string, string[]>();

    if (orderIds.length > 0) {
      const [tripRows] = await pool.execute<OrderTripRow[]>(
        `SELECT ct.\`ma_don_ve\`, ct.\`ky_hieu_ghe\`, ct.\`ma_chuyen\`,
                c.\`ma_tuyen\`, t.\`ten_tuyen\`, t.\`tinh_di\`, t.\`tinh_den\`,
                c.\`thoi_gian_xuat_ben\`
         FROM \`chi_tiet_ve\` ct
         INNER JOIN \`chuyen_xe\` c ON c.\`ma_chuyen\` = ct.\`ma_chuyen\`
         INNER JOIN \`tuyen_duong\` t ON t.\`ma_tuyen\` = c.\`ma_tuyen\`
         WHERE ct.\`ma_don_ve\` IN (${placeholders(orderIds.length)})
         ORDER BY ct.\`ma_don_ve\` ASC, ct.\`ma_ve\` ASC`,
        orderIds,
      );

      for (const tripRow of tripRows) {
        const orderId = String(tripRow.ma_don_ve);
        const seats = seatsByOrder.get(orderId) ?? [];
        seats.push(String(tripRow.ky_hieu_ghe));
        seatsByOrder.set(orderId, seats);

        if (!tripByOrder.has(orderId)) {
          tripByOrder.set(orderId, tripRow);
        }
      }
    }

    return {
      items: rows.map((row) => {
        const orderId = String(row.ma_don_ve);
        return mapOrderList(row, tripByOrder.get(orderId), seatsByOrder.get(orderId) ?? []);
      }),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  public async findTripForBooking(
    tripId: number,
    executor: DbExecutor = pool,
    lock = false,
  ): Promise<BookingTripInfo | null> {
    const [rows] = await executor.execute<TripRow[]>(
      `SELECT c.\`ma_chuyen\`, c.\`ma_tuyen\`, x.\`ma_loai_xe\`,
              c.\`gia_ve_co_ban\`, c.\`trang_thai\`, c.\`thoi_gian_xuat_ben\`
       FROM \`chuyen_xe\` c
       INNER JOIN \`xe\` x ON x.\`ma_xe\` = c.\`ma_xe\`
       WHERE c.\`ma_chuyen\` = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
      [tripId],
    );

    const row = rows[0];
    return row ? mapTrip(row) : null;
  }

  public async findSeatsByCodes(
    tripId: number,
    seatCodes: string[],
    executor: DbExecutor = pool,
  ): Promise<BookingSeatInfo[]> {
    if (seatCodes.length === 0) {
      return [];
    }

    const [rows] = await executor.execute<SeatRow[]>(
      `SELECT g.\`ma_ghe\`, g.\`ky_hieu_ghe\`, g.\`loai_cho\`
       FROM \`chuyen_xe\` c
       INNER JOIN \`xe\` x ON x.\`ma_xe\` = c.\`ma_xe\`
       INNER JOIN \`so_do_ghe\` g ON g.\`ma_loai_xe\` = x.\`ma_loai_xe\`
       WHERE c.\`ma_chuyen\` = ? AND g.\`ky_hieu_ghe\` IN (${placeholders(seatCodes.length)})
       ORDER BY g.\`tang\` ASC, g.\`hang\` ASC, g.\`cot\` ASC`,
      [tripId, ...seatCodes],
    );

    return rows.map(mapSeat);
  }

  public async findRouteStop(
    stopId: number,
    executor: DbExecutor = pool,
  ): Promise<BookingStopInfo | null> {
    const [rows] = await executor.execute<StopRow[]>(
      `SELECT \`ma_diem_dung\`, \`ma_tuyen\`, \`loai_diem\`, \`thu_tu_dung\`
       FROM \`diem_dung\` WHERE \`ma_diem_dung\` = ? LIMIT 1`,
      [stopId],
    );

    const row = rows[0];
    return row ? mapStop(row) : null;
  }

  public async findBookedSeatCodes(
    tripId: number,
    seatCodes: string[],
    executor: DbExecutor = pool,
  ): Promise<Set<string>> {
    if (seatCodes.length === 0) {
      return new Set<string>();
    }

    const [rows] = await executor.execute<SeatCodeRow[]>(
      `SELECT ct.\`ky_hieu_ghe\`
       FROM \`chi_tiet_ve\` ct
       INNER JOIN \`don_dat_ve\` d ON d.\`ma_don_ve\` = ct.\`ma_don_ve\`
       WHERE ct.\`ma_chuyen\` = ?
         AND ct.\`ky_hieu_ghe\` IN (${placeholders(seatCodes.length)})
         AND ct.\`trang_thai_ve\` = 'HIEU_LUC'
         AND d.\`trang_thai_don\` IN ('CHO_THANH_TOAN', 'DA_THANH_TOAN')`,
      [tripId, ...seatCodes],
    );

    return new Set(rows.map((row) => String(row.ky_hieu_ghe)));
  }

  public async createOrder(input: CreateOrderInput, executor: DbExecutor): Promise<string> {
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO \`don_dat_ve\`
        (\`ma_dinh_danh_don\`, \`ma_khach_hang\`, \`ho_ten_khach\`, \`so_dien_thoai_khach\`,
         \`email_khach\`, \`ma_nhan_vien_ban\`, \`ma_chi_nhanh_ban\`, \`ma_diem_don\`,
         \`ma_diem_tra\`, \`tong_tien\`, \`trang_thai_don\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.ma_dinh_danh_don,
        input.ma_khach_hang,
        input.ho_ten_khach,
        input.so_dien_thoai_khach,
        input.email_khach,
        input.ma_nhan_vien_ban,
        input.ma_chi_nhanh_ban,
        input.ma_diem_don,
        input.ma_diem_tra,
        input.tong_tien,
        input.trang_thai_don,
      ],
    );

    return String(result.insertId);
  }

  public async createTickets(inputs: CreateTicketInput[], executor: DbExecutor): Promise<void> {
    if (inputs.length === 0) {
      return;
    }

    const values = inputs.flatMap((ticket) => [
      ticket.ma_don_ve,
      ticket.ma_chuyen,
      ticket.ma_ghe,
      ticket.ky_hieu_ghe,
      ticket.gia_ve,
      ticket.ma_qr_kiem_tra,
      ticket.trang_thai_ve,
    ]);

    await executor.execute(
      `INSERT INTO \`chi_tiet_ve\`
        (\`ma_don_ve\`, \`ma_chuyen\`, \`ma_ghe\`, \`ky_hieu_ghe\`, \`gia_ve\`,
         \`ma_qr_kiem_tra\`, \`trang_thai_ve\`)
       VALUES ${inputs.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      values,
    );
  }

  public async createPayment(input: CreatePaymentInput, executor: DbExecutor): Promise<string> {
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO \`thanh_toan\`
        (\`ma_don_ve\`, \`phuong_thuc\`, \`so_tien\`, \`trang_thai\`, \`thoi_gian_thanh_toan\`)
       VALUES (?, ?, ?, ?, CASE WHEN ? = 'THANH_CONG' THEN UTC_TIMESTAMP() ELSE NULL END)`,
      [input.ma_don_ve, input.phuong_thuc, input.so_tien, input.trang_thai, input.trang_thai],
    );

    return String(result.insertId);
  }

  public async findOrderById(
    id: string,
    executor: DbExecutor = pool,
  ): Promise<BookingRecord | null> {
    const [orderRows] = await executor.execute<OrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM \`don_dat_ve\` WHERE \`ma_don_ve\` = ? LIMIT 1`,
      [id],
    );

    const order = orderRows[0];
    if (!order) {
      return null;
    }

    const [ticketRows] = await executor.execute<TicketRow[]>(
      `SELECT \`ma_ve\`, \`ma_chuyen\`, \`ma_ghe\`, \`ky_hieu_ghe\`, \`gia_ve\`,
              \`ma_qr_kiem_tra\`, \`trang_thai_soat_ve\`, \`trang_thai_ve\`
       FROM \`chi_tiet_ve\` WHERE \`ma_don_ve\` = ? ORDER BY \`ma_ve\` ASC`,
      [id],
    );

    const [paymentRows] = await executor.execute<PaymentRow[]>(
      `SELECT \`ma_thanh_toan\`, \`phuong_thuc\`, \`ma_giao_dich_vnpay\`, \`so_tien\`,
              \`trang_thai\`, \`thoi_gian_thanh_toan\`
       FROM \`thanh_toan\` WHERE \`ma_don_ve\` = ? ORDER BY \`ma_thanh_toan\` ASC`,
      [id],
    );

    return mapOrder(order, ticketRows.map(mapTicket), paymentRows.map(mapPayment));
  }

  public async lockOrder(id: string, executor: DbExecutor): Promise<BookingRecord | null> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      'SELECT `ma_don_ve` FROM `don_dat_ve` WHERE `ma_don_ve` = ? LIMIT 1 FOR UPDATE',
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    return this.findOrderById(id, executor);
  }

  public async findOrderByIdentifier(code: string): Promise<BookingRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT `ma_don_ve` FROM `don_dat_ve` WHERE `ma_dinh_danh_don` = ? LIMIT 1',
      [code],
    );

    const row = rows[0];
    return row ? this.findOrderById(String(row.ma_don_ve)) : null;
  }

  public async cancelOrder(id: string, executor: DbExecutor): Promise<void> {
    await executor.execute(
      `UPDATE \`chi_tiet_ve\` SET \`trang_thai_ve\` = 'DA_HUY' WHERE \`ma_don_ve\` = ?`,
      [id],
    );

    await executor.execute(
      `UPDATE \`don_dat_ve\` SET \`trang_thai_don\` = 'DA_HUY'
       WHERE \`ma_don_ve\` = ? AND \`trang_thai_don\` = 'CHO_THANH_TOAN'`,
      [id],
    );
  }

  public async confirmCashPayment(id: string, executor: DbExecutor): Promise<void> {
    await executor.execute(
      `UPDATE \`thanh_toan\`
       SET \`trang_thai\` = 'THANH_CONG', \`thoi_gian_thanh_toan\` = UTC_TIMESTAMP()
       WHERE \`ma_don_ve\` = ? AND \`phuong_thuc\` = 'TIEN_MAT' AND \`trang_thai\` = 'CHO_XU_LY'`,
      [id],
    );

    await executor.execute(
      `UPDATE \`don_dat_ve\` SET \`trang_thai_don\` = 'DA_THANH_TOAN'
       WHERE \`ma_don_ve\` = ? AND \`trang_thai_don\` = 'CHO_THANH_TOAN'`,
      [id],
    );
  }

  public async findExpiredOrders(cutoffUtc: string, limit: number): Promise<ExpiredBookingOrder[]> {
    const [rows] = await pool.execute<ExpiredOrderRow[]>(
      `SELECT d.\`ma_don_ve\`, ct.\`ma_chuyen\`, ct.\`ky_hieu_ghe\`
       FROM \`don_dat_ve\` d
       INNER JOIN \`chi_tiet_ve\` ct ON ct.\`ma_don_ve\` = d.\`ma_don_ve\`
       WHERE d.\`trang_thai_don\` = 'CHO_THANH_TOAN'
         AND d.\`thoi_gian_tao\` < ?
         AND ct.\`trang_thai_ve\` = 'HIEU_LUC'
         AND d.\`ma_don_ve\` IN (
           SELECT \`ma_don_ve\` FROM \`don_dat_ve\`
           WHERE \`trang_thai_don\` = 'CHO_THANH_TOAN' AND \`thoi_gian_tao\` < ?
           ORDER BY \`thoi_gian_tao\` ASC
           LIMIT ${Math.max(Math.trunc(limit), 1)}
         )
       ORDER BY d.\`thoi_gian_tao\` ASC`,
      [cutoffUtc, cutoffUtc],
    );

    const grouped = new Map<string, ExpiredBookingOrder>();

    for (const row of rows) {
      const orderId = String(row.ma_don_ve);
      const existing = grouped.get(orderId);

      if (existing) {
        existing.danh_sach_ghe.push(String(row.ky_hieu_ghe));
        continue;
      }

      grouped.set(orderId, {
        ma_don_ve: orderId,
        ma_chuyen: Number(row.ma_chuyen),
        danh_sach_ghe: [String(row.ky_hieu_ghe)],
      });
    }

    return [...grouped.values()];
  }
}
