import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import type { DbExecutor } from '../../db/types';
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleListFilters,
  VehicleRecord,
  VehicleRepositoryPort,
  VehicleStatus,
} from './vehicles.types';

interface VehicleRow extends RowDataPacket {
  ma_xe: number;
  ma_loai_xe: number;
  ten_loai_xe: string;
  tong_so_ghe: number;
  bien_so_xe: string;
  hang_san_xuat: string | null;
  trang_thai: string;
}

interface CountRow extends RowDataPacket {
  total: string | number;
}

const VEHICLE_SELECT = `
  SELECT
    x.\`ma_xe\`,
    x.\`ma_loai_xe\`,
    lx.\`ten_loai_xe\`,
    lx.\`tong_so_ghe\`,
    x.\`bien_so_xe\`,
    x.\`hang_san_xuat\`,
    x.\`trang_thai\`
  FROM \`xe\` x
  INNER JOIN \`loai_xe\` lx ON lx.\`ma_loai_xe\` = x.\`ma_loai_xe\`
`;

function mapVehicle(row: VehicleRow): VehicleRecord {
  return {
    ma_xe: Number(row.ma_xe),
    ma_loai_xe: Number(row.ma_loai_xe),
    ten_loai_xe: String(row.ten_loai_xe),
    tong_so_ghe: Number(row.tong_so_ghe),
    bien_so_xe: String(row.bien_so_xe),
    hang_san_xuat: row.hang_san_xuat === null ? null : String(row.hang_san_xuat),
    trang_thai: String(row.trang_thai) as VehicleStatus,
  };
}

export class VehicleRepository implements VehicleRepositoryPort {
  public async list(
    filters: VehicleListFilters,
  ): Promise<{ items: VehicleRecord[]; total: number }> {
    const where: string[] = [];
    const params: Array<string | number | boolean | null> = [];

    if (filters.q) {
      where.push('(x.`bien_so_xe` LIKE ? OR x.`hang_san_xuat` LIKE ?)');
      params.push(`%${filters.q}%`, `%${filters.q}%`);
    }

    if (filters.ma_loai_xe !== null) {
      where.push('x.`ma_loai_xe` = ?');
      params.push(filters.ma_loai_xe);
    }

    if (filters.trang_thai !== null) {
      where.push('x.`trang_thai` = ?');
      params.push(filters.trang_thai);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM \`xe\` x ${whereSql}`,
      params,
    );

    const [rows] = await pool.execute<VehicleRow[]>(
      `${VEHICLE_SELECT} ${whereSql}
       ORDER BY x.\`ma_xe\` DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.pagination.limit, filters.pagination.offset],
    );

    return {
      items: rows.map(mapVehicle),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  public async findById(id: number, executor: DbExecutor = pool): Promise<VehicleRecord | null> {
    const [rows] = await executor.execute<VehicleRow[]>(
      `${VEHICLE_SELECT} WHERE x.\`ma_xe\` = ? LIMIT 1`,
      [id],
    );

    const row = rows[0];
    return row ? mapVehicle(row) : null;
  }

  public async plateExists(plate: string, excludeId?: number): Promise<boolean> {
    const params: Array<string | number | boolean | null> = [plate];
    let sql = 'SELECT 1 FROM `xe` WHERE `bien_so_xe` = ?';

    if (excludeId !== undefined) {
      sql += ' AND `ma_xe` <> ?';
      params.push(excludeId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(`${sql} LIMIT 1`, params);
    return rows.length > 0;
  }

  public async vehicleTypeExists(id: number, executor: DbExecutor = pool): Promise<boolean> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      'SELECT 1 FROM `loai_xe` WHERE `ma_loai_xe` = ? LIMIT 1',
      [id],
    );

    return rows.length > 0;
  }

  public async create(input: CreateVehicleInput, executor: DbExecutor = pool): Promise<number> {
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO \`xe\` (\`ma_loai_xe\`, \`bien_so_xe\`, \`hang_san_xuat\`, \`trang_thai\`)
       VALUES (?, ?, ?, ?)`,
      [input.ma_loai_xe, input.bien_so_xe, input.hang_san_xuat, input.trang_thai],
    );

    return Number(result.insertId);
  }

  public async update(
    id: number,
    input: UpdateVehicleInput,
    executor: DbExecutor = pool,
  ): Promise<void> {
    await executor.execute(
      `UPDATE \`xe\`
       SET \`ma_loai_xe\` = ?, \`bien_so_xe\` = ?, \`hang_san_xuat\` = ?, \`trang_thai\` = ?
       WHERE \`ma_xe\` = ?`,
      [input.ma_loai_xe, input.bien_so_xe, input.hang_san_xuat, input.trang_thai, id],
    );
  }

  public async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM `xe` WHERE `ma_xe` = ?', [
      id,
    ]);

    return result.affectedRows > 0;
  }

  public async hasTrips(id: number, executor: DbExecutor = pool): Promise<boolean> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      'SELECT 1 FROM `chuyen_xe` WHERE `ma_xe` = ? LIMIT 1',
      [id],
    );

    return rows.length > 0;
  }
}
