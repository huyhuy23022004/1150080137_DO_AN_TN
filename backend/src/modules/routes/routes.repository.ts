import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import type { DbExecutor } from '../../db/types';
import type {
  CreateRouteInput,
  RouteListFilters,
  RouteRecord,
  RouteRepositoryPort,
  RouteStopInput,
  RouteStopRecord,
  StopType,
  UpdateRouteInput,
} from './routes.types';

interface RouteRow extends RowDataPacket {
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  khoang_cach_km: string;
  thoi_gian_chay_du_kien: number;
  trang_thai: number | boolean;
}

interface StopRow extends RowDataPacket {
  ma_diem_dung: number;
  ma_tuyen: number;
  ten_diem_dung: string;
  dia_chi: string | null;
  loai_diem: string;
  thu_tu_dung: number;
}

interface CountRow extends RowDataPacket {
  total: string | number;
}

const ROUTE_COLUMNS = `
  \`ma_tuyen\`, \`ten_tuyen\`, \`tinh_di\`, \`tinh_den\`,
  \`khoang_cach_km\`, \`thoi_gian_chay_du_kien\`, \`trang_thai\`
`;

function mapStop(row: StopRow): RouteStopRecord {
  return {
    ma_diem_dung: Number(row.ma_diem_dung),
    ten_diem_dung: String(row.ten_diem_dung),
    dia_chi: row.dia_chi === null ? null : String(row.dia_chi),
    loai_diem: String(row.loai_diem) as StopType,
    thu_tu_dung: Number(row.thu_tu_dung),
  };
}

function mapRoute(row: RouteRow, stops: RouteStopRecord[]): RouteRecord {
  return {
    ma_tuyen: Number(row.ma_tuyen),
    ten_tuyen: String(row.ten_tuyen),
    tinh_di: String(row.tinh_di),
    tinh_den: String(row.tinh_den),
    khoang_cach_km: String(row.khoang_cach_km),
    thoi_gian_chay_du_kien: Number(row.thoi_gian_chay_du_kien),
    trang_thai: Boolean(row.trang_thai),
    diem_dung: stops,
  };
}

export class RouteRepository implements RouteRepositoryPort {
  public async list(filters: RouteListFilters): Promise<{ items: RouteRecord[]; total: number }> {
    const where: string[] = [];
    const params: Array<string | number | boolean | null> = [];

    if (filters.q) {
      where.push('`ten_tuyen` LIKE ?');
      params.push(`%${filters.q}%`);
    }

    if (filters.tinh_di) {
      where.push('`tinh_di` LIKE ?');
      params.push(`%${filters.tinh_di}%`);
    }

    if (filters.tinh_den) {
      where.push('`tinh_den` LIKE ?');
      params.push(`%${filters.tinh_den}%`);
    }

    if (filters.trang_thai !== null) {
      where.push('`trang_thai` = ?');
      params.push(filters.trang_thai ? 1 : 0);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM \`tuyen_duong\` ${whereSql}`,
      params,
    );

    const [rows] = await pool.execute<RouteRow[]>(
      `SELECT ${ROUTE_COLUMNS} FROM \`tuyen_duong\` ${whereSql}
       ORDER BY \`ten_tuyen\` ASC
       LIMIT ? OFFSET ?`,
      [...params, filters.pagination.limit, filters.pagination.offset],
    );

    const ids = rows.map((row) => Number(row.ma_tuyen));
    const stopsByRoute = await this.loadStops(ids, pool);

    return {
      items: rows.map((row) => mapRoute(row, stopsByRoute.get(Number(row.ma_tuyen)) ?? [])),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  public async findById(id: number, executor: DbExecutor = pool): Promise<RouteRecord | null> {
    const [rows] = await executor.execute<RouteRow[]>(
      `SELECT ${ROUTE_COLUMNS} FROM \`tuyen_duong\` WHERE \`ma_tuyen\` = ? LIMIT 1`,
      [id],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const stopsByRoute = await this.loadStops([id], executor);
    return mapRoute(row, stopsByRoute.get(id) ?? []);
  }

  public async nameExists(name: string, excludeId?: number): Promise<boolean> {
    const params: Array<string | number | boolean | null> = [name];
    let sql = 'SELECT 1 FROM `tuyen_duong` WHERE `ten_tuyen` = ?';

    if (excludeId !== undefined) {
      sql += ' AND `ma_tuyen` <> ?';
      params.push(excludeId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(`${sql} LIMIT 1`, params);
    return rows.length > 0;
  }

  public async create(
    input: Omit<CreateRouteInput, 'diem_dung'>,
    executor: DbExecutor,
  ): Promise<number> {
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO \`tuyen_duong\`
        (\`ten_tuyen\`, \`tinh_di\`, \`tinh_den\`, \`khoang_cach_km\`, \`thoi_gian_chay_du_kien\`, \`trang_thai\`)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.ten_tuyen,
        input.tinh_di,
        input.tinh_den,
        input.khoang_cach_km,
        input.thoi_gian_chay_du_kien,
        input.trang_thai ? 1 : 0,
      ],
    );

    return Number(result.insertId);
  }

  public async update(
    id: number,
    input: Omit<UpdateRouteInput, 'diem_dung'>,
    executor: DbExecutor,
  ): Promise<void> {
    await executor.execute(
      `UPDATE \`tuyen_duong\`
       SET \`ten_tuyen\` = ?, \`tinh_di\` = ?, \`tinh_den\` = ?,
           \`khoang_cach_km\` = ?, \`thoi_gian_chay_du_kien\` = ?, \`trang_thai\` = ?
       WHERE \`ma_tuyen\` = ?`,
      [
        input.ten_tuyen,
        input.tinh_di,
        input.tinh_den,
        input.khoang_cach_km,
        input.thoi_gian_chay_du_kien,
        input.trang_thai ? 1 : 0,
        id,
      ],
    );
  }

  public async replaceStops(
    id: number,
    stops: RouteStopInput[],
    executor: DbExecutor,
  ): Promise<void> {
    await executor.execute('DELETE FROM `diem_dung` WHERE `ma_tuyen` = ?', [id]);

    if (stops.length === 0) {
      return;
    }

    const placeholders = stops.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const values = stops.flatMap((stop) => [
      id,
      stop.ten_diem_dung,
      stop.dia_chi,
      stop.loai_diem,
      stop.thu_tu_dung,
    ]);

    await executor.execute(
      `INSERT INTO \`diem_dung\`
        (\`ma_tuyen\`, \`ten_diem_dung\`, \`dia_chi\`, \`loai_diem\`, \`thu_tu_dung\`)
       VALUES ${placeholders}`,
      values,
    );
  }

  public async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM `tuyen_duong` WHERE `ma_tuyen` = ?',
      [id],
    );

    return result.affectedRows > 0;
  }

  public async hasTrips(id: number, executor: DbExecutor = pool): Promise<boolean> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      'SELECT 1 FROM `chuyen_xe` WHERE `ma_tuyen` = ? LIMIT 1',
      [id],
    );

    return rows.length > 0;
  }

  public async hasOrders(id: number, executor: DbExecutor = pool): Promise<boolean> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      `SELECT 1
       FROM \`don_dat_ve\` d
       INNER JOIN \`diem_dung\` dd ON dd.\`ma_diem_dung\` IN (d.\`ma_diem_don\`, d.\`ma_diem_tra\`)
       WHERE dd.\`ma_tuyen\` = ?
       LIMIT 1`,
      [id],
    );

    return rows.length > 0;
  }

  private async loadStops(
    ids: number[],
    executor: DbExecutor,
  ): Promise<Map<number, RouteStopRecord[]>> {
    const result = new Map<number, RouteStopRecord[]>();

    if (ids.length === 0) {
      return result;
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await executor.query<StopRow[]>(
      `SELECT \`ma_diem_dung\`, \`ma_tuyen\`, \`ten_diem_dung\`, \`dia_chi\`, \`loai_diem\`, \`thu_tu_dung\`
       FROM \`diem_dung\`
       WHERE \`ma_tuyen\` IN (${placeholders})
       ORDER BY \`thu_tu_dung\` ASC, \`ma_diem_dung\` ASC`,
      ids,
    );

    for (const row of rows) {
      const routeId = Number(row.ma_tuyen);
      const stops = result.get(routeId) ?? [];
      stops.push(mapStop(row));
      result.set(routeId, stops);
    }

    return result;
  }
}
