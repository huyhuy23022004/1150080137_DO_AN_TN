import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import type { DbExecutor } from '../../db/types';
import type {
  CreateVehicleTypeInput,
  SeatInput,
  SeatRecord,
  SeatType,
  VehicleTypeListFilters,
  VehicleTypeRecord,
  VehicleTypeRepositoryPort,
} from './vehicle-types.types';

interface VehicleTypeRow extends RowDataPacket {
  ma_loai_xe: number;
  ten_loai_xe: string;
  so_tang: number;
  tong_so_ghe: number;
}

interface SeatRow extends RowDataPacket {
  ma_ghe: number;
  ma_loai_xe: number;
  ky_hieu_ghe: string;
  tang: number;
  hang: number;
  cot: number;
  loai_cho: string;
}

interface CountRow extends RowDataPacket {
  total: string | number;
}

const TYPE_COLUMNS = '`ma_loai_xe`, `ten_loai_xe`, `so_tang`, `tong_so_ghe`';

function mapSeat(row: SeatRow): SeatRecord {
  return {
    ma_ghe: Number(row.ma_ghe),
    ky_hieu_ghe: String(row.ky_hieu_ghe),
    tang: Number(row.tang),
    hang: Number(row.hang),
    cot: Number(row.cot),
    loai_cho: String(row.loai_cho) as SeatType,
  };
}

function mapType(row: VehicleTypeRow, seats: SeatRecord[]): VehicleTypeRecord {
  return {
    ma_loai_xe: Number(row.ma_loai_xe),
    ten_loai_xe: String(row.ten_loai_xe),
    so_tang: Number(row.so_tang),
    tong_so_ghe: Number(row.tong_so_ghe),
    so_do_ghe: seats,
  };
}

export class VehicleTypeRepository implements VehicleTypeRepositoryPort {
  public async list(
    filters: VehicleTypeListFilters,
  ): Promise<{ items: VehicleTypeRecord[]; total: number }> {
    const where: string[] = [];
    const params: Array<string | number | boolean | null> = [];

    if (filters.q) {
      where.push('`ten_loai_xe` LIKE ?');
      params.push(`%${filters.q}%`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM \`loai_xe\` ${whereSql}`,
      params,
    );

    const [rows] = await pool.execute<VehicleTypeRow[]>(
      `SELECT ${TYPE_COLUMNS} FROM \`loai_xe\` ${whereSql}
       ORDER BY \`ma_loai_xe\` DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.pagination.limit, filters.pagination.offset],
    );

    const ids = rows.map((row) => Number(row.ma_loai_xe));
    const seatsByType = await this.loadSeats(ids, pool);

    return {
      items: rows.map((row) => mapType(row, seatsByType.get(Number(row.ma_loai_xe)) ?? [])),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  public async findById(
    id: number,
    executor: DbExecutor = pool,
  ): Promise<VehicleTypeRecord | null> {
    const [rows] = await executor.execute<VehicleTypeRow[]>(
      `SELECT ${TYPE_COLUMNS} FROM \`loai_xe\` WHERE \`ma_loai_xe\` = ? LIMIT 1`,
      [id],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const seatsByType = await this.loadSeats([id], executor);
    return mapType(row, seatsByType.get(id) ?? []);
  }

  public async nameExists(name: string, excludeId?: number): Promise<boolean> {
    const params: Array<string | number | boolean | null> = [name];
    let sql = 'SELECT 1 FROM `loai_xe` WHERE `ten_loai_xe` = ?';

    if (excludeId !== undefined) {
      sql += ' AND `ma_loai_xe` <> ?';
      params.push(excludeId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(`${sql} LIMIT 1`, params);
    return rows.length > 0;
  }

  public async create(
    input: Omit<CreateVehicleTypeInput, 'so_do_ghe'> & { tong_so_ghe: number },
    executor: DbExecutor,
  ): Promise<number> {
    const [result] = await executor.execute<ResultSetHeader>(
      'INSERT INTO `loai_xe` (`ten_loai_xe`, `so_tang`, `tong_so_ghe`) VALUES (?, ?, ?)',
      [input.ten_loai_xe, input.so_tang, input.tong_so_ghe],
    );

    return Number(result.insertId);
  }

  public async update(
    id: number,
    input: { ten_loai_xe: string; so_tang: number; tong_so_ghe: number },
    executor: DbExecutor,
  ): Promise<void> {
    await executor.execute(
      'UPDATE `loai_xe` SET `ten_loai_xe` = ?, `so_tang` = ?, `tong_so_ghe` = ? WHERE `ma_loai_xe` = ?',
      [input.ten_loai_xe, input.so_tang, input.tong_so_ghe, id],
    );
  }

  public async replaceSeats(id: number, seats: SeatInput[], executor: DbExecutor): Promise<void> {
    await executor.execute('DELETE FROM `so_do_ghe` WHERE `ma_loai_xe` = ?', [id]);

    if (seats.length === 0) {
      return;
    }

    const placeholders = seats.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const values = seats.flatMap((seat) => [
      id,
      seat.ky_hieu_ghe,
      seat.tang,
      seat.hang,
      seat.cot,
      seat.loai_cho,
    ]);

    await executor.execute(
      `INSERT INTO \`so_do_ghe\`
        (\`ma_loai_xe\`, \`ky_hieu_ghe\`, \`tang\`, \`hang\`, \`cot\`, \`loai_cho\`)
       VALUES ${placeholders}`,
      values,
    );
  }

  public async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM `loai_xe` WHERE `ma_loai_xe` = ?',
      [id],
    );

    return result.affectedRows > 0;
  }

  public async hasVehicles(id: number, executor: DbExecutor = pool): Promise<boolean> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      'SELECT 1 FROM `xe` WHERE `ma_loai_xe` = ? LIMIT 1',
      [id],
    );

    return rows.length > 0;
  }

  public async hasTickets(id: number, executor: DbExecutor = pool): Promise<boolean> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      `SELECT 1
       FROM \`chi_tiet_ve\` ct
       INNER JOIN \`so_do_ghe\` g ON g.\`ma_ghe\` = ct.\`ma_ghe\`
       WHERE g.\`ma_loai_xe\` = ? AND ct.\`trang_thai_ve\` = 'HIEU_LUC'
       LIMIT 1`,
      [id],
    );

    return rows.length > 0;
  }

  private async loadSeats(ids: number[], executor: DbExecutor): Promise<Map<number, SeatRecord[]>> {
    const result = new Map<number, SeatRecord[]>();

    if (ids.length === 0) {
      return result;
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await executor.query<SeatRow[]>(
      `SELECT \`ma_ghe\`, \`ma_loai_xe\`, \`ky_hieu_ghe\`, \`tang\`, \`hang\`, \`cot\`, \`loai_cho\`
       FROM \`so_do_ghe\`
       WHERE \`ma_loai_xe\` IN (${placeholders})
       ORDER BY \`tang\` ASC, \`hang\` ASC, \`cot\` ASC, \`ma_ghe\` ASC`,
      ids,
    );

    for (const row of rows) {
      const typeId = Number(row.ma_loai_xe);
      const seats = result.get(typeId) ?? [];
      seats.push(mapSeat(row));
      result.set(typeId, seats);
    }

    return result;
  }
}
