import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import type { DbExecutor } from '../../db/types';
import type {
  BranchListFilters,
  BranchRecord,
  BranchRepositoryPort,
  CreateBranchInput,
  UpdateBranchInput,
} from './branches.types';

interface BranchRow extends RowDataPacket {
  ma_chi_nhanh: number;
  ma_dinh_danh: string;
  ten_chi_nhanh: string;
  so_dien_thoai: string;
  dia_chi: string;
  tinh_thanh: string;
  trang_thai_hoat_dong: number | boolean;
}

interface CountRow extends RowDataPacket {
  total: string | number;
}

const BRANCH_COLUMNS = `
  \`ma_chi_nhanh\`, \`ma_dinh_danh\`, \`ten_chi_nhanh\`, \`so_dien_thoai\`,
  \`dia_chi\`, \`tinh_thanh\`, \`trang_thai_hoat_dong\`
`;

function mapBranch(row: BranchRow): BranchRecord {
  return {
    ma_chi_nhanh: Number(row.ma_chi_nhanh),
    ma_dinh_danh: String(row.ma_dinh_danh),
    ten_chi_nhanh: String(row.ten_chi_nhanh),
    so_dien_thoai: String(row.so_dien_thoai),
    dia_chi: String(row.dia_chi),
    tinh_thanh: String(row.tinh_thanh),
    trang_thai_hoat_dong: Boolean(row.trang_thai_hoat_dong),
  };
}

export class BranchRepository implements BranchRepositoryPort {
  public async list(filters: BranchListFilters): Promise<{ items: BranchRecord[]; total: number }> {
    const where: string[] = [];
    const params: Array<string | number | boolean | null> = [];

    if (filters.q) {
      where.push('(`ten_chi_nhanh` LIKE ? OR `ma_dinh_danh` LIKE ? OR `so_dien_thoai` LIKE ?)');
      params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }

    if (filters.tinh_thanh) {
      where.push('`tinh_thanh` LIKE ?');
      params.push(`%${filters.tinh_thanh}%`);
    }

    if (filters.trang_thai_hoat_dong !== null) {
      where.push('`trang_thai_hoat_dong` = ?');
      params.push(filters.trang_thai_hoat_dong ? 1 : 0);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM \`chi_nhanh\` ${whereSql}`,
      params,
    );

    const [rows] = await pool.execute<BranchRow[]>(
      `SELECT ${BRANCH_COLUMNS} FROM \`chi_nhanh\` ${whereSql}
       ORDER BY \`ten_chi_nhanh\` ASC
       LIMIT ? OFFSET ?`,
      [...params, filters.pagination.limit, filters.pagination.offset],
    );

    return {
      items: rows.map(mapBranch),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  public async findById(id: number, executor: DbExecutor = pool): Promise<BranchRecord | null> {
    const [rows] = await executor.execute<BranchRow[]>(
      `SELECT ${BRANCH_COLUMNS} FROM \`chi_nhanh\` WHERE \`ma_chi_nhanh\` = ? LIMIT 1`,
      [id],
    );

    const row = rows[0];
    return row ? mapBranch(row) : null;
  }

  public async codeExists(code: string, excludeId?: number): Promise<boolean> {
    const params: Array<string | number> = [code];
    let sql = 'SELECT 1 FROM `chi_nhanh` WHERE `ma_dinh_danh` = ?';

    if (excludeId !== undefined) {
      sql += ' AND `ma_chi_nhanh` <> ?';
      params.push(excludeId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(`${sql} LIMIT 1`, params);
    return rows.length > 0;
  }

  public async phoneExists(phone: string, excludeId?: number): Promise<boolean> {
    const params: Array<string | number> = [phone];
    let sql = 'SELECT 1 FROM `chi_nhanh` WHERE `so_dien_thoai` = ?';

    if (excludeId !== undefined) {
      sql += ' AND `ma_chi_nhanh` <> ?';
      params.push(excludeId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(`${sql} LIMIT 1`, params);
    return rows.length > 0;
  }

  public async create(input: CreateBranchInput, executor: DbExecutor): Promise<number> {
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO \`chi_nhanh\`
        (\`ma_dinh_danh\`, \`ten_chi_nhanh\`, \`so_dien_thoai\`, \`dia_chi\`, \`tinh_thanh\`, \`trang_thai_hoat_dong\`)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.ma_dinh_danh,
        input.ten_chi_nhanh,
        input.so_dien_thoai,
        input.dia_chi,
        input.tinh_thanh,
        input.trang_thai_hoat_dong ? 1 : 0,
      ],
    );

    return Number(result.insertId);
  }

  public async update(id: number, input: UpdateBranchInput, executor: DbExecutor): Promise<void> {
    await executor.execute(
      `UPDATE \`chi_nhanh\`
       SET \`ma_dinh_danh\` = ?, \`ten_chi_nhanh\` = ?, \`so_dien_thoai\` = ?,
           \`dia_chi\` = ?, \`tinh_thanh\` = ?, \`trang_thai_hoat_dong\` = ?
       WHERE \`ma_chi_nhanh\` = ?`,
      [
        input.ma_dinh_danh,
        input.ten_chi_nhanh,
        input.so_dien_thoai,
        input.dia_chi,
        input.tinh_thanh,
        input.trang_thai_hoat_dong ? 1 : 0,
        id,
      ],
    );
  }

  public async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM `chi_nhanh` WHERE `ma_chi_nhanh` = ?',
      [id],
    );

    return result.affectedRows > 0;
  }

  public async hasUsers(id: number, executor: DbExecutor = pool): Promise<boolean> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      'SELECT 1 FROM `nguoi_dung` WHERE `ma_chi_nhanh` = ? LIMIT 1',
      [id],
    );

    return rows.length > 0;
  }

  public async hasOrders(id: number, executor: DbExecutor = pool): Promise<boolean> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      'SELECT 1 FROM `don_dat_ve` WHERE `ma_chi_nhanh_ban` = ? LIMIT 1',
      [id],
    );

    return rows.length > 0;
  }
}
