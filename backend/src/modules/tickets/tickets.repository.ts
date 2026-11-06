import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import type { DbExecutor } from '../../db/types';
import { toIsoUtc } from '../../utils/datetime';
import type {
  PassengerRecord,
  TicketListFilters,
  TicketRecord,
  TicketRepositoryPort,
  TicketTripAssignment,
} from './tickets.types';

interface TicketRow extends RowDataPacket {
  ma_ve: string | number;
  ma_don_ve: string | number;
  ma_dinh_danh_don: string;
  ma_chuyen: number;
  ma_ghe: number;
  ky_hieu_ghe: string;
  gia_ve: string;
  ma_qr_kiem_tra: string;
  trang_thai_soat_ve: string;
  thoi_gian_soat_ve: string | null;
  tai_xe_soat_ve: string | number | null;
  trang_thai_ve: string;
  ma_khach_hang: string | number | null;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  ma_chi_nhanh_ban: number | null;
  trang_thai_don: string;
  thoi_gian_tao: string;
  thoi_gian_xuat_ben: string;
  trang_thai_chuyen: string;
  ma_tai_xe: string | number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  bien_so_xe: string;
  ten_tai_xe: string;
}

interface CountRow extends RowDataPacket {
  total: string | number;
}

interface PassengerRow extends RowDataPacket {
  ma_ve: string | number;
  ma_don_ve: string | number;
  ma_dinh_danh_don: string;
  ky_hieu_ghe: string;
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach: string | null;
  trang_thai_soat_ve: string;
  thoi_gian_soat_ve: string | null;
}

interface TripRow extends RowDataPacket {
  ma_chuyen: number;
  ma_tai_xe: string | number;
  thoi_gian_xuat_ben: string;
  trang_thai: string;
  ma_chi_nhanh_tai_xe: number | null;
}

const TICKET_SELECT = `
  SELECT ct.\`ma_ve\`, ct.\`ma_don_ve\`, d.\`ma_dinh_danh_don\`, ct.\`ma_chuyen\`,
         ct.\`ma_ghe\`, ct.\`ky_hieu_ghe\`, ct.\`gia_ve\`, ct.\`ma_qr_kiem_tra\`,
         ct.\`trang_thai_soat_ve\`, ct.\`thoi_gian_soat_ve\`, ct.\`tai_xe_soat_ve\`,
         ct.\`trang_thai_ve\`, d.\`ma_khach_hang\`, d.\`ho_ten_khach\`,
         d.\`so_dien_thoai_khach\`, d.\`email_khach\`, d.\`ma_chi_nhanh_ban\`,
         d.\`trang_thai_don\`, d.\`thoi_gian_tao\`, c.\`thoi_gian_xuat_ben\`,
         c.\`trang_thai\` AS \`trang_thai_chuyen\`, c.\`ma_tai_xe\`,
         t.\`ten_tuyen\`, t.\`tinh_di\`, t.\`tinh_den\`, x.\`bien_so_xe\`,
         u.\`ho_va_ten\` AS \`ten_tai_xe\`
  FROM \`chi_tiet_ve\` ct
  INNER JOIN \`don_dat_ve\` d ON d.\`ma_don_ve\` = ct.\`ma_don_ve\`
  INNER JOIN \`chuyen_xe\` c ON c.\`ma_chuyen\` = ct.\`ma_chuyen\`
  INNER JOIN \`tuyen_duong\` t ON t.\`ma_tuyen\` = c.\`ma_tuyen\`
  INNER JOIN \`xe\` x ON x.\`ma_xe\` = c.\`ma_xe\`
  INNER JOIN \`nguoi_dung\` u ON u.\`ma_nguoi_dung\` = c.\`ma_tai_xe\`
`;

function mapTicket(row: TicketRow): TicketRecord {
  return {
    ma_ve: String(row.ma_ve),
    ma_don_ve: String(row.ma_don_ve),
    ma_dinh_danh_don: String(row.ma_dinh_danh_don),
    ma_chuyen: Number(row.ma_chuyen),
    ma_ghe: Number(row.ma_ghe),
    ky_hieu_ghe: String(row.ky_hieu_ghe),
    gia_ve: String(row.gia_ve),
    ma_qr_kiem_tra: String(row.ma_qr_kiem_tra),
    trang_thai_soat_ve: String(row.trang_thai_soat_ve),
    thoi_gian_soat_ve: toIsoUtc(row.thoi_gian_soat_ve),
    tai_xe_soat_ve: row.tai_xe_soat_ve === null ? null : String(row.tai_xe_soat_ve),
    trang_thai_ve: String(row.trang_thai_ve),
    ma_khach_hang: row.ma_khach_hang === null ? null : String(row.ma_khach_hang),
    ho_ten_khach: String(row.ho_ten_khach),
    so_dien_thoai_khach: String(row.so_dien_thoai_khach),
    email_khach: row.email_khach === null ? null : String(row.email_khach),
    ma_chi_nhanh_ban: row.ma_chi_nhanh_ban === null ? null : Number(row.ma_chi_nhanh_ban),
    trang_thai_don: String(row.trang_thai_don),
    thoi_gian_tao: toIsoUtc(row.thoi_gian_tao) ?? String(row.thoi_gian_tao),
    thoi_gian_xuat_ben: toIsoUtc(row.thoi_gian_xuat_ben) ?? String(row.thoi_gian_xuat_ben),
    trang_thai_chuyen: String(row.trang_thai_chuyen),
    ma_tai_xe: String(row.ma_tai_xe),
    ten_tuyen: String(row.ten_tuyen),
    tinh_di: String(row.tinh_di),
    tinh_den: String(row.tinh_den),
    bien_so_xe: String(row.bien_so_xe),
    ten_tai_xe: String(row.ten_tai_xe),
  };
}

function mapPassenger(row: PassengerRow): PassengerRecord {
  return {
    ma_ve: String(row.ma_ve),
    ma_don_ve: String(row.ma_don_ve),
    ma_dinh_danh_don: String(row.ma_dinh_danh_don),
    ky_hieu_ghe: String(row.ky_hieu_ghe),
    ho_ten_khach: String(row.ho_ten_khach),
    so_dien_thoai_khach: String(row.so_dien_thoai_khach),
    email_khach: row.email_khach === null ? null : String(row.email_khach),
    trang_thai_soat_ve: String(row.trang_thai_soat_ve),
    thoi_gian_soat_ve: toIsoUtc(row.thoi_gian_soat_ve),
  };
}

export class TicketRepository implements TicketRepositoryPort {
  public async listByCustomer(
    customerId: string,
    filters: TicketListFilters,
  ): Promise<{ items: TicketRecord[]; total: number }> {
    const where: string[] = ['d.`ma_khach_hang` = ?'];
    const params: Array<string | number> = [customerId];

    if (filters.trang_thai_soat_ve) {
      where.push('ct.`trang_thai_soat_ve` = ?');
      params.push(filters.trang_thai_soat_ve);
    }

    if (filters.trang_thai_don) {
      where.push('d.`trang_thai_don` = ?');
      params.push(filters.trang_thai_don);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total
       FROM \`chi_tiet_ve\` ct
       INNER JOIN \`don_dat_ve\` d ON d.\`ma_don_ve\` = ct.\`ma_don_ve\`
       ${whereSql}`,
      params,
    );

    const [rows] = await pool.execute<TicketRow[]>(
      `${TICKET_SELECT} ${whereSql}
       ORDER BY c.\`thoi_gian_xuat_ben\` DESC, ct.\`ma_ve\` DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.pagination.limit, filters.pagination.offset],
    );

    return {
      items: rows.map(mapTicket),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  public async findById(
    ticketId: string,
    executor: DbExecutor = pool,
  ): Promise<TicketRecord | null> {
    const [rows] = await executor.execute<TicketRow[]>(
      `${TICKET_SELECT} WHERE ct.\`ma_ve\` = ? LIMIT 1`,
      [ticketId],
    );

    const row = rows[0];
    return row ? mapTicket(row) : null;
  }

  public async findByToken(
    token: string,
    executor: DbExecutor = pool,
    lock = false,
  ): Promise<TicketRecord | null> {
    const [rows] = await executor.execute<TicketRow[]>(
      `${TICKET_SELECT} WHERE ct.\`ma_qr_kiem_tra\` = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
      [token],
    );

    const row = rows[0];
    return row ? mapTicket(row) : null;
  }

  public async updateCheckin(
    ticketId: string,
    driverId: string,
    executor: DbExecutor,
  ): Promise<boolean> {
    const [result] = await executor.execute<ResultSetHeader>(
      `UPDATE \`chi_tiet_ve\`
       SET \`trang_thai_soat_ve\` = 'DA_LEN_XE',
           \`thoi_gian_soat_ve\` = UTC_TIMESTAMP(),
           \`tai_xe_soat_ve\` = ?
       WHERE \`ma_ve\` = ? AND \`trang_thai_soat_ve\` = 'CHUA_LEN_XE'
         AND \`trang_thai_ve\` = 'HIEU_LUC'`,
      [driverId, ticketId],
    );

    return result.affectedRows > 0;
  }

  public async findTripAssignment(
    tripId: number,
    executor: DbExecutor = pool,
  ): Promise<TicketTripAssignment | null> {
    const [rows] = await executor.execute<TripRow[]>(
      `SELECT c.\`ma_chuyen\`, c.\`ma_tai_xe\`, c.\`thoi_gian_xuat_ben\`,
              c.\`trang_thai\`, u.\`ma_chi_nhanh\` AS \`ma_chi_nhanh_tai_xe\`
       FROM \`chuyen_xe\` c
       INNER JOIN \`nguoi_dung\` u ON u.\`ma_nguoi_dung\` = c.\`ma_tai_xe\`
       WHERE c.\`ma_chuyen\` = ? LIMIT 1`,
      [tripId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      ma_chuyen: Number(row.ma_chuyen),
      ma_tai_xe: String(row.ma_tai_xe),
      thoi_gian_xuat_ben: toIsoUtc(row.thoi_gian_xuat_ben) ?? String(row.thoi_gian_xuat_ben),
      trang_thai: String(row.trang_thai),
      ma_chi_nhanh_tai_xe:
        row.ma_chi_nhanh_tai_xe === null ? null : Number(row.ma_chi_nhanh_tai_xe),
    };
  }

  public async listPassengersByTrip(
    tripId: number,
    executor: DbExecutor = pool,
  ): Promise<PassengerRecord[]> {
    const [rows] = await executor.execute<PassengerRow[]>(
      `SELECT ct.\`ma_ve\`, ct.\`ma_don_ve\`, d.\`ma_dinh_danh_don\`,
              ct.\`ky_hieu_ghe\`, d.\`ho_ten_khach\`, d.\`so_dien_thoai_khach\`,
              d.\`email_khach\`, ct.\`trang_thai_soat_ve\`, ct.\`thoi_gian_soat_ve\`
       FROM \`chi_tiet_ve\` ct
       INNER JOIN \`don_dat_ve\` d ON d.\`ma_don_ve\` = ct.\`ma_don_ve\`
       WHERE ct.\`ma_chuyen\` = ?
         AND ct.\`trang_thai_ve\` = 'HIEU_LUC'
         AND d.\`trang_thai_don\` = 'DA_THANH_TOAN'
       ORDER BY ct.\`ky_hieu_ghe\` ASC, ct.\`ma_ve\` ASC`,
      [tripId],
    );

    return rows.map(mapPassenger);
  }
}
