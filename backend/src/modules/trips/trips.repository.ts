import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import type { DbExecutor } from '../../db/types';
import { toIsoUtc } from '../../utils/datetime';
import type { RouteStopRecord, StopType } from '../routes/routes.types';
import type { SeatRecord, SeatType } from '../vehicle-types/vehicle-types.types';
import type {
  CreateTripInput,
  TripDriverInfo,
  TripListFilters,
  TripRecord,
  TripRepositoryPort,
  TripRouteInfo,
  TripStatus,
  TripVehicleInfo,
  UpdateTripInput,
} from './trips.types';

interface TripRow extends RowDataPacket {
  ma_chuyen: number;
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  ma_xe: number;
  bien_so_xe: string;
  ma_loai_xe: number;
  ten_loai_xe: string;
  tong_so_ghe: number;
  ma_tai_xe: string | number;
  ten_tai_xe: string;
  so_dien_thoai_tai_xe: string;
  ma_chi_nhanh_tai_xe: number | null;
  thoi_gian_xuat_ben: string;
  thoi_gian_den_du_kien: string;
  gia_ve_co_ban: string;
  trang_thai: string;
  so_ghe_da_dat: string | number;
  so_ghe_dang_giu: string | number;
}

interface CountRow extends RowDataPacket {
  total: string | number;
}

interface RouteRow extends RowDataPacket {
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  thoi_gian_chay_du_kien: number;
  trang_thai: number | boolean;
}

interface VehicleRow extends RowDataPacket {
  ma_xe: number;
  ma_loai_xe: number;
  bien_so_xe: string;
  trang_thai: string;
  tong_so_ghe: number;
}

interface DriverRow extends RowDataPacket {
  ma_nguoi_dung: string | number;
  ho_va_ten: string;
  ten_vai_tro: string;
  trang_thai_tai_khoan: string;
  ma_chi_nhanh: number | null;
}

interface StopRow extends RowDataPacket {
  ma_diem_dung: number;
  ten_diem_dung: string;
  dia_chi: string | null;
  loai_diem: string;
  thu_tu_dung: number;
}

interface SeatRow extends RowDataPacket {
  ma_ghe: number;
  ky_hieu_ghe: string;
  tang: number;
  hang: number;
  cot: number;
  loai_cho: string;
}

interface SeatCodeRow extends RowDataPacket {
  ky_hieu_ghe: string;
}

interface TripIdRow extends RowDataPacket {
  ma_chuyen: number;
}

const TRIP_SELECT = `
  SELECT
    c.\`ma_chuyen\`,
    c.\`ma_tuyen\`,
    t.\`ten_tuyen\`,
    t.\`tinh_di\`,
    t.\`tinh_den\`,
    c.\`ma_xe\`,
    x.\`bien_so_xe\`,
    lx.\`ma_loai_xe\`,
    lx.\`ten_loai_xe\`,
    lx.\`tong_so_ghe\`,
    c.\`ma_tai_xe\`,
    u.\`ho_va_ten\` AS \`ten_tai_xe\`,
    u.\`so_dien_thoai\` AS \`so_dien_thoai_tai_xe\`,
    u.\`ma_chi_nhanh\` AS \`ma_chi_nhanh_tai_xe\`,
    c.\`thoi_gian_xuat_ben\`,
    c.\`thoi_gian_den_du_kien\`,
    c.\`gia_ve_co_ban\`,
    c.\`trang_thai\`,
    (
      SELECT COUNT(*)
      FROM \`chi_tiet_ve\` ct
      INNER JOIN \`don_dat_ve\` d ON d.\`ma_don_ve\` = ct.\`ma_don_ve\`
      WHERE ct.\`ma_chuyen\` = c.\`ma_chuyen\`
        AND ct.\`trang_thai_ve\` = 'HIEU_LUC'
        AND d.\`trang_thai_don\` IN ('CHO_THANH_TOAN', 'DA_THANH_TOAN')
    ) AS \`so_ghe_da_dat\`,
    (
      SELECT COUNT(*)
      FROM \`giu_cho_tam_thoi\` g
      WHERE g.\`ma_chuyen\` = c.\`ma_chuyen\`
        AND g.\`thoi_gian_het_han\` > UTC_TIMESTAMP()
    ) AS \`so_ghe_dang_giu\`
  FROM \`chuyen_xe\` c
  INNER JOIN \`tuyen_duong\` t ON t.\`ma_tuyen\` = c.\`ma_tuyen\`
  INNER JOIN \`xe\` x ON x.\`ma_xe\` = c.\`ma_xe\`
  INNER JOIN \`loai_xe\` lx ON lx.\`ma_loai_xe\` = x.\`ma_loai_xe\`
  INNER JOIN \`nguoi_dung\` u ON u.\`ma_nguoi_dung\` = c.\`ma_tai_xe\`
`;

function mapTrip(row: TripRow): TripRecord {
  const totalSeats = Number(row.tong_so_ghe);
  const bookedSeats = Number(row.so_ghe_da_dat);
  const heldSeats = Number(row.so_ghe_dang_giu);

  return {
    ma_chuyen: Number(row.ma_chuyen),
    ma_tuyen: Number(row.ma_tuyen),
    ten_tuyen: String(row.ten_tuyen),
    tinh_di: String(row.tinh_di),
    tinh_den: String(row.tinh_den),
    ma_xe: Number(row.ma_xe),
    bien_so_xe: String(row.bien_so_xe),
    ma_loai_xe: Number(row.ma_loai_xe),
    ten_loai_xe: String(row.ten_loai_xe),
    tong_so_ghe: totalSeats,
    ma_tai_xe: String(row.ma_tai_xe),
    ten_tai_xe: String(row.ten_tai_xe),
    so_dien_thoai_tai_xe: String(row.so_dien_thoai_tai_xe),
    ma_chi_nhanh_tai_xe: row.ma_chi_nhanh_tai_xe === null ? null : Number(row.ma_chi_nhanh_tai_xe),
    thoi_gian_xuat_ben: toIsoUtc(row.thoi_gian_xuat_ben) ?? String(row.thoi_gian_xuat_ben),
    thoi_gian_den_du_kien: toIsoUtc(row.thoi_gian_den_du_kien) ?? String(row.thoi_gian_den_du_kien),
    gia_ve_co_ban: String(row.gia_ve_co_ban),
    trang_thai: String(row.trang_thai) as TripStatus,
    so_ghe_da_dat: bookedSeats,
    so_ghe_dang_giu: heldSeats,
    so_ghe_trong: Math.max(totalSeats - bookedSeats - heldSeats, 0),
  };
}

function mapRoute(row: RouteRow): TripRouteInfo {
  return {
    ma_tuyen: Number(row.ma_tuyen),
    ten_tuyen: String(row.ten_tuyen),
    tinh_di: String(row.tinh_di),
    tinh_den: String(row.tinh_den),
    thoi_gian_chay_du_kien: Number(row.thoi_gian_chay_du_kien),
    trang_thai: Boolean(row.trang_thai),
  };
}

function mapVehicle(row: VehicleRow): TripVehicleInfo {
  return {
    ma_xe: Number(row.ma_xe),
    ma_loai_xe: Number(row.ma_loai_xe),
    bien_so_xe: String(row.bien_so_xe),
    trang_thai: String(row.trang_thai),
  };
}

function mapDriver(row: DriverRow): TripDriverInfo {
  return {
    ma_nguoi_dung: String(row.ma_nguoi_dung),
    ho_va_ten: String(row.ho_va_ten),
    ten_vai_tro: String(row.ten_vai_tro),
    trang_thai_tai_khoan: String(row.trang_thai_tai_khoan),
    ma_chi_nhanh: row.ma_chi_nhanh === null ? null : Number(row.ma_chi_nhanh),
  };
}

function buildWhere(
  filters: TripListFilters,
  publicOnly: boolean,
): {
  whereSql: string;
  params: Array<string | number | boolean | null>;
} {
  const where: string[] = [];
  const params: Array<string | number | boolean | null> = [];

  if (publicOnly) {
    where.push("c.`trang_thai` = 'SAP_CHAY'");
  } else if (filters.trang_thai !== null) {
    where.push('c.`trang_thai` = ?');
    params.push(filters.trang_thai);
  }

  if (filters.tinh_di) {
    where.push('t.`tinh_di` LIKE ?');
    params.push(`%${filters.tinh_di}%`);
  }

  if (filters.tinh_den) {
    where.push('t.`tinh_den` LIKE ?');
    params.push(`%${filters.tinh_den}%`);
  }

  if (filters.ma_tuyen !== null) {
    where.push('c.`ma_tuyen` = ?');
    params.push(filters.ma_tuyen);
  }

  if (filters.ma_xe !== null) {
    where.push('c.`ma_xe` = ?');
    params.push(filters.ma_xe);
  }

  if (filters.ma_tai_xe !== null) {
    where.push('c.`ma_tai_xe` = ?');
    params.push(filters.ma_tai_xe);
  }

  if (filters.branchId !== null) {
    where.push('u.`ma_chi_nhanh` = ?');
    params.push(filters.branchId);
  }

  if (filters.startUtc !== null) {
    where.push('c.`thoi_gian_xuat_ben` >= ?');
    params.push(filters.startUtc);
  }

  if (filters.endUtc !== null) {
    where.push('c.`thoi_gian_xuat_ben` < ?');
    params.push(filters.endUtc);
  }

  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

export class TripRepository implements TripRepositoryPort {
  public async search(filters: TripListFilters): Promise<{ items: TripRecord[]; total: number }> {
    return this.listWithFilters(filters, true);
  }

  public async list(filters: TripListFilters): Promise<{ items: TripRecord[]; total: number }> {
    return this.listWithFilters(filters, false);
  }

  public async findById(id: number, executor: DbExecutor = pool): Promise<TripRecord | null> {
    const [rows] = await executor.execute<TripRow[]>(
      `${TRIP_SELECT} WHERE c.\`ma_chuyen\` = ? LIMIT 1`,
      [id],
    );

    const row = rows[0];
    return row ? mapTrip(row) : null;
  }

  public async lockTripRow(id: number, executor: DbExecutor): Promise<TripRecord | null> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      'SELECT `ma_chuyen` FROM `chuyen_xe` WHERE `ma_chuyen` = ? LIMIT 1 FOR UPDATE',
      [id],
    );

    if (rows.length === 0) {
      return null;
    }

    return this.findById(id, executor);
  }

  public async findRouteById(
    id: number,
    executor: DbExecutor = pool,
  ): Promise<TripRouteInfo | null> {
    return this.selectRoute(id, executor, false);
  }

  public async findVehicleById(
    id: number,
    executor: DbExecutor = pool,
  ): Promise<TripVehicleInfo | null> {
    return this.selectVehicle(id, executor, false);
  }

  public async findDriverById(
    id: string,
    executor: DbExecutor = pool,
  ): Promise<TripDriverInfo | null> {
    return this.selectDriver(id, executor, false);
  }

  public async lockRoute(id: number, executor: DbExecutor): Promise<TripRouteInfo | null> {
    return this.selectRoute(id, executor, true);
  }

  public async lockVehicle(id: number, executor: DbExecutor): Promise<TripVehicleInfo | null> {
    return this.selectVehicle(id, executor, true);
  }

  public async lockDriver(id: string, executor: DbExecutor): Promise<TripDriverInfo | null> {
    return this.selectDriver(id, executor, true);
  }

  public async findRouteStops(
    routeId: number,
    executor: DbExecutor = pool,
  ): Promise<RouteStopRecord[]> {
    const [rows] = await executor.execute<StopRow[]>(
      `SELECT \`ma_diem_dung\`, \`ten_diem_dung\`, \`dia_chi\`, \`loai_diem\`, \`thu_tu_dung\`
       FROM \`diem_dung\`
       WHERE \`ma_tuyen\` = ?
       ORDER BY \`thu_tu_dung\` ASC, \`ma_diem_dung\` ASC`,
      [routeId],
    );

    return rows.map((row) => ({
      ma_diem_dung: Number(row.ma_diem_dung),
      ten_diem_dung: String(row.ten_diem_dung),
      dia_chi: row.dia_chi === null ? null : String(row.dia_chi),
      loai_diem: String(row.loai_diem) as StopType,
      thu_tu_dung: Number(row.thu_tu_dung),
    }));
  }

  public async findSeatLayout(
    vehicleTypeId: number,
    executor: DbExecutor = pool,
  ): Promise<SeatRecord[]> {
    const [rows] = await executor.execute<SeatRow[]>(
      `SELECT \`ma_ghe\`, \`ky_hieu_ghe\`, \`tang\`, \`hang\`, \`cot\`, \`loai_cho\`
       FROM \`so_do_ghe\`
       WHERE \`ma_loai_xe\` = ?
       ORDER BY \`tang\` ASC, \`hang\` ASC, \`cot\` ASC, \`ma_ghe\` ASC`,
      [vehicleTypeId],
    );

    return rows.map((row) => ({
      ma_ghe: Number(row.ma_ghe),
      ky_hieu_ghe: String(row.ky_hieu_ghe),
      tang: Number(row.tang),
      hang: Number(row.hang),
      cot: Number(row.cot),
      loai_cho: String(row.loai_cho) as SeatType,
    }));
  }

  public async findVehicleConflict(
    vehicleId: number,
    startUtc: string,
    endUtc: string,
    excludeId: number | null,
    executor: DbExecutor,
  ): Promise<number | null> {
    return this.findConflict('ma_xe', vehicleId, startUtc, endUtc, excludeId, executor);
  }

  public async findDriverConflict(
    driverId: string,
    startUtc: string,
    endUtc: string,
    excludeId: number | null,
    executor: DbExecutor,
  ): Promise<number | null> {
    return this.findConflict('ma_tai_xe', driverId, startUtc, endUtc, excludeId, executor);
  }

  public async create(input: CreateTripInput, executor: DbExecutor): Promise<number> {
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO \`chuyen_xe\`
        (\`ma_tuyen\`, \`ma_xe\`, \`ma_tai_xe\`, \`thoi_gian_xuat_ben\`, \`thoi_gian_den_du_kien\`,
         \`gia_ve_co_ban\`, \`trang_thai\`)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.ma_tuyen,
        input.ma_xe,
        input.ma_tai_xe,
        input.thoi_gian_xuat_ben,
        input.thoi_gian_den_du_kien,
        input.gia_ve_co_ban,
        input.trang_thai,
      ],
    );

    return Number(result.insertId);
  }

  public async update(id: number, input: UpdateTripInput, executor: DbExecutor): Promise<void> {
    await executor.execute(
      `UPDATE \`chuyen_xe\`
       SET \`ma_tuyen\` = ?, \`ma_xe\` = ?, \`ma_tai_xe\` = ?,
           \`thoi_gian_xuat_ben\` = ?, \`thoi_gian_den_du_kien\` = ?, \`gia_ve_co_ban\` = ?
       WHERE \`ma_chuyen\` = ?`,
      [
        input.ma_tuyen,
        input.ma_xe,
        input.ma_tai_xe,
        input.thoi_gian_xuat_ben,
        input.thoi_gian_den_du_kien,
        input.gia_ve_co_ban,
        id,
      ],
    );
  }

  public async updateStatus(id: number, status: TripStatus): Promise<void> {
    await pool.execute('UPDATE `chuyen_xe` SET `trang_thai` = ? WHERE `ma_chuyen` = ?', [
      status,
      id,
    ]);
  }

  public async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM `chuyen_xe` WHERE `ma_chuyen` = ?',
      [id],
    );

    return result.affectedRows > 0;
  }

  public async countTickets(id: number, executor: DbExecutor = pool): Promise<number> {
    const [rows] = await executor.execute<CountRow[]>(
      `SELECT COUNT(*) AS total
       FROM \`chi_tiet_ve\`
       WHERE \`ma_chuyen\` = ? AND \`trang_thai_ve\` = 'HIEU_LUC'`,
      [id],
    );

    return Number(rows[0]?.total ?? 0);
  }

  public async findBookedSeatCodes(
    tripId: number,
    executor: DbExecutor = pool,
  ): Promise<Set<string>> {
    const [rows] = await executor.execute<SeatCodeRow[]>(
      `SELECT DISTINCT ct.\`ky_hieu_ghe\`
       FROM \`chi_tiet_ve\` ct
       INNER JOIN \`don_dat_ve\` d ON d.\`ma_don_ve\` = ct.\`ma_don_ve\`
       WHERE ct.\`ma_chuyen\` = ?
         AND ct.\`trang_thai_ve\` = 'HIEU_LUC'
         AND d.\`trang_thai_don\` IN ('CHO_THANH_TOAN', 'DA_THANH_TOAN')`,
      [tripId],
    );

    return new Set(rows.map((row) => String(row.ky_hieu_ghe)));
  }

  public async findHeldSeatCodes(
    tripId: number,
    executor: DbExecutor = pool,
  ): Promise<Set<string>> {
    const [rows] = await executor.execute<SeatCodeRow[]>(
      `SELECT \`ky_hieu_ghe\`
       FROM \`giu_cho_tam_thoi\`
       WHERE \`ma_chuyen\` = ? AND \`thoi_gian_het_han\` > UTC_TIMESTAMP()`,
      [tripId],
    );

    return new Set(rows.map((row) => String(row.ky_hieu_ghe)));
  }

  private async listWithFilters(
    filters: TripListFilters,
    publicOnly: boolean,
  ): Promise<{ items: TripRecord[]; total: number }> {
    const { whereSql, params } = buildWhere(filters, publicOnly);

    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total
       FROM \`chuyen_xe\` c
       INNER JOIN \`tuyen_duong\` t ON t.\`ma_tuyen\` = c.\`ma_tuyen\`
       INNER JOIN \`nguoi_dung\` u ON u.\`ma_nguoi_dung\` = c.\`ma_tai_xe\`
       ${whereSql}`,
      params,
    );

    const [rows] = await pool.execute<TripRow[]>(
      `${TRIP_SELECT} ${whereSql}
       ORDER BY c.\`thoi_gian_xuat_ben\` ASC, c.\`ma_chuyen\` ASC
       LIMIT ? OFFSET ?`,
      [...params, filters.pagination.limit, filters.pagination.offset],
    );

    return {
      items: rows.map(mapTrip),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  private async selectRoute(
    id: number,
    executor: DbExecutor,
    lock: boolean,
  ): Promise<TripRouteInfo | null> {
    const [rows] = await executor.execute<RouteRow[]>(
      `SELECT \`ma_tuyen\`, \`ten_tuyen\`, \`tinh_di\`, \`tinh_den\`,
              \`thoi_gian_chay_du_kien\`, \`trang_thai\`
       FROM \`tuyen_duong\`
       WHERE \`ma_tuyen\` = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );

    const row = rows[0];
    return row ? mapRoute(row) : null;
  }

  private async selectVehicle(
    id: number,
    executor: DbExecutor,
    lock: boolean,
  ): Promise<TripVehicleInfo | null> {
    const [rows] = await executor.execute<VehicleRow[]>(
      `SELECT \`ma_xe\`, \`ma_loai_xe\`, \`bien_so_xe\`, \`trang_thai\`
       FROM \`xe\`
       WHERE \`ma_xe\` = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );

    const row = rows[0];
    return row ? mapVehicle(row) : null;
  }

  private async selectDriver(
    id: string,
    executor: DbExecutor,
    lock: boolean,
  ): Promise<TripDriverInfo | null> {
    const [rows] = await executor.execute<DriverRow[]>(
      `SELECT u.\`ma_nguoi_dung\`, u.\`ho_va_ten\`, v.\`ten_vai_tro\`,
              u.\`trang_thai_tai_khoan\`, u.\`ma_chi_nhanh\`
       FROM \`nguoi_dung\` u
       INNER JOIN \`vai_tro\` v ON v.\`ma_vai_tro\` = u.\`ma_vai_tro\`
       WHERE u.\`ma_nguoi_dung\` = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );

    const row = rows[0];
    return row ? mapDriver(row) : null;
  }

  private async findConflict(
    column: 'ma_xe' | 'ma_tai_xe',
    id: number | string,
    startUtc: string,
    endUtc: string,
    excludeId: number | null,
    executor: DbExecutor,
  ): Promise<number | null> {
    const [rows] = await executor.execute<TripIdRow[]>(
      `SELECT \`ma_chuyen\`
       FROM \`chuyen_xe\`
       WHERE \`${column}\` = ?
         AND \`trang_thai\` <> 'HUY'
         AND \`thoi_gian_xuat_ben\` < ?
         AND \`thoi_gian_den_du_kien\` > ?
         AND (? IS NULL OR \`ma_chuyen\` <> ?)
       ORDER BY \`ma_chuyen\` ASC
       LIMIT 1
       FOR UPDATE`,
      [id, endUtc, startUtc, excludeId, excludeId],
    );

    const row = rows[0];
    return row ? Number(row.ma_chuyen) : null;
  }
}
