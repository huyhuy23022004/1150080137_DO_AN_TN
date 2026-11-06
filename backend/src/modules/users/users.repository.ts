import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import { isRoleName, type AccountStatus } from '../../common/constants';
import type { DbExecutor } from '../../db/types';
import { toIsoUtc } from '../../utils/datetime';
import type {
  BranchOptionRecord,
  CreateUserInput,
  RoleRecord,
  UpdateUserInput,
  UserListFilters,
  UserRecord,
  UserRepositoryPort,
  UserWithPassword,
} from './users.types';

interface UserRow extends RowDataPacket {
  ma_nguoi_dung: string | number;
  ma_vai_tro: number;
  ten_vai_tro: string;
  ma_chi_nhanh: number | null;
  ten_chi_nhanh: string | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
  mat_khau_ma_hoa: string;
  trang_thai_tai_khoan: string;
  thoi_gian_tao: string;
}

interface RoleRow extends RowDataPacket {
  ma_vai_tro: number;
  ten_vai_tro: string;
  mo_ta: string | null;
}

interface BranchRow extends RowDataPacket {
  ma_chi_nhanh: number;
  ma_dinh_danh: string;
  ten_chi_nhanh: string;
  trang_thai_hoat_dong: number | boolean;
}

interface CountRow extends RowDataPacket {
  total: string | number;
}

const USER_SELECT = `
  SELECT
    u.\`ma_nguoi_dung\`,
    u.\`ma_vai_tro\`,
    v.\`ten_vai_tro\`,
    u.\`ma_chi_nhanh\`,
    c.\`ten_chi_nhanh\`,
    u.\`ho_va_ten\`,
    u.\`so_dien_thoai\`,
    u.\`email\`,
    u.\`trang_thai_tai_khoan\`,
    u.\`thoi_gian_tao\`
  FROM \`nguoi_dung\` u
  INNER JOIN \`vai_tro\` v ON v.\`ma_vai_tro\` = u.\`ma_vai_tro\`
  LEFT JOIN \`chi_nhanh\` c ON c.\`ma_chi_nhanh\` = u.\`ma_chi_nhanh\`
`;

function mapRoleName(value: string): UserRecord['ten_vai_tro'] {
  if (!isRoleName(value)) {
    throw new Error(`Unknown role in database: ${value}`);
  }

  return value;
}

function mapUser(row: UserRow): UserRecord {
  return {
    ma_nguoi_dung: String(row.ma_nguoi_dung),
    ma_vai_tro: Number(row.ma_vai_tro),
    ten_vai_tro: mapRoleName(row.ten_vai_tro),
    ma_chi_nhanh: row.ma_chi_nhanh === null ? null : Number(row.ma_chi_nhanh),
    ten_chi_nhanh: row.ten_chi_nhanh === null ? null : String(row.ten_chi_nhanh),
    ho_va_ten: String(row.ho_va_ten),
    so_dien_thoai: String(row.so_dien_thoai),
    email: row.email === null ? null : String(row.email),
    trang_thai_tai_khoan: String(row.trang_thai_tai_khoan) as AccountStatus,
    thoi_gian_tao: toIsoUtc(row.thoi_gian_tao) ?? String(row.thoi_gian_tao),
  };
}

function mapUserWithPassword(row: UserRow): UserWithPassword {
  return {
    ...mapUser(row),
    mat_khau_ma_hoa: String(row.mat_khau_ma_hoa),
  };
}

function mapRole(row: RoleRow): RoleRecord {
  return {
    ma_vai_tro: Number(row.ma_vai_tro),
    ten_vai_tro: mapRoleName(row.ten_vai_tro),
    mo_ta: row.mo_ta === null ? null : String(row.mo_ta),
  };
}

function mapBranch(row: BranchRow): BranchOptionRecord {
  return {
    ma_chi_nhanh: Number(row.ma_chi_nhanh),
    ma_dinh_danh: String(row.ma_dinh_danh),
    ten_chi_nhanh: String(row.ten_chi_nhanh),
    trang_thai_hoat_dong: Boolean(row.trang_thai_hoat_dong),
  };
}

export class UserRepository implements UserRepositoryPort {
  public async list(filters: UserListFilters): Promise<{ items: UserRecord[]; total: number }> {
    const where: string[] = [];
    const params: Array<string | number | null> = [];

    if (filters.q) {
      where.push('(u.`ho_va_ten` LIKE ? OR u.`so_dien_thoai` LIKE ? OR u.`email` LIKE ?)');
      params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }

    if (filters.ma_vai_tro !== null) {
      where.push('u.`ma_vai_tro` = ?');
      params.push(filters.ma_vai_tro);
    }

    if (filters.ma_chi_nhanh !== null) {
      where.push('u.`ma_chi_nhanh` = ?');
      params.push(filters.ma_chi_nhanh);
    }

    if (filters.trang_thai_tai_khoan !== null) {
      where.push('u.`trang_thai_tai_khoan` = ?');
      params.push(filters.trang_thai_tai_khoan);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM \`nguoi_dung\` u ${whereSql}`,
      params,
    );

    const [rows] = await pool.execute<UserRow[]>(
      `${USER_SELECT} ${whereSql}
       ORDER BY u.\`ma_nguoi_dung\` DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.pagination.limit, filters.pagination.offset],
    );

    return {
      items: rows.map(mapUser),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  public async findById(id: string, executor: DbExecutor = pool): Promise<UserWithPassword | null> {
    const [rows] = await executor.execute<UserRow[]>(
      `SELECT
         u.\`ma_nguoi_dung\`, u.\`ma_vai_tro\`, v.\`ten_vai_tro\`, u.\`ma_chi_nhanh\`,
         c.\`ten_chi_nhanh\`, u.\`ho_va_ten\`, u.\`so_dien_thoai\`, u.\`email\`,
         u.\`mat_khau_ma_hoa\`, u.\`trang_thai_tai_khoan\`, u.\`thoi_gian_tao\`
       FROM \`nguoi_dung\` u
       INNER JOIN \`vai_tro\` v ON v.\`ma_vai_tro\` = u.\`ma_vai_tro\`
       LEFT JOIN \`chi_nhanh\` c ON c.\`ma_chi_nhanh\` = u.\`ma_chi_nhanh\`
       WHERE u.\`ma_nguoi_dung\` = ? LIMIT 1`,
      [id],
    );

    const row = rows[0];
    return row ? mapUserWithPassword(row) : null;
  }

  public async phoneExists(phone: string, excludeId?: string): Promise<boolean> {
    const params: string[] = [phone];
    let sql = 'SELECT 1 FROM `nguoi_dung` WHERE `so_dien_thoai` = ?';

    if (excludeId !== undefined) {
      sql += ' AND `ma_nguoi_dung` <> ?';
      params.push(excludeId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(`${sql} LIMIT 1`, params);
    return rows.length > 0;
  }

  public async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const params: string[] = [email];
    let sql = 'SELECT 1 FROM `nguoi_dung` WHERE `email` = ?';

    if (excludeId !== undefined) {
      sql += ' AND `ma_nguoi_dung` <> ?';
      params.push(excludeId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(`${sql} LIMIT 1`, params);
    return rows.length > 0;
  }

  public async findRoleById(id: number): Promise<RoleRecord | null> {
    const [rows] = await pool.execute<RoleRow[]>(
      'SELECT `ma_vai_tro`, `ten_vai_tro`, `mo_ta` FROM `vai_tro` WHERE `ma_vai_tro` = ? LIMIT 1',
      [id],
    );

    const row = rows[0];
    return row ? mapRole(row) : null;
  }

  public async findBranchById(id: number): Promise<BranchOptionRecord | null> {
    const [rows] = await pool.execute<BranchRow[]>(
      `SELECT \`ma_chi_nhanh\`, \`ma_dinh_danh\`, \`ten_chi_nhanh\`, \`trang_thai_hoat_dong\`
       FROM \`chi_nhanh\` WHERE \`ma_chi_nhanh\` = ? LIMIT 1`,
      [id],
    );

    const row = rows[0];
    return row ? mapBranch(row) : null;
  }

  public async listRoles(): Promise<RoleRecord[]> {
    const [rows] = await pool.execute<RoleRow[]>(
      'SELECT `ma_vai_tro`, `ten_vai_tro`, `mo_ta` FROM `vai_tro` ORDER BY `ma_vai_tro` ASC',
    );

    return rows.map(mapRole);
  }

  public async create(input: CreateUserInput, executor: DbExecutor): Promise<string> {
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO \`nguoi_dung\`
        (\`ma_vai_tro\`, \`ma_chi_nhanh\`, \`ho_va_ten\`, \`so_dien_thoai\`, \`email\`,
         \`mat_khau_ma_hoa\`, \`trang_thai_tai_khoan\`)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.ma_vai_tro,
        input.ma_chi_nhanh,
        input.ho_va_ten,
        input.so_dien_thoai,
        input.email,
        input.mat_khau_ma_hoa,
        input.trang_thai_tai_khoan,
      ],
    );

    return String(result.insertId);
  }

  public async update(id: string, input: UpdateUserInput, executor: DbExecutor): Promise<void> {
    await executor.execute(
      `UPDATE \`nguoi_dung\`
       SET \`ma_vai_tro\` = ?, \`ma_chi_nhanh\` = ?, \`ho_va_ten\` = ?,
           \`so_dien_thoai\` = ?, \`email\` = ?, \`trang_thai_tai_khoan\` = ?
       WHERE \`ma_nguoi_dung\` = ?`,
      [
        input.ma_vai_tro,
        input.ma_chi_nhanh,
        input.ho_va_ten,
        input.so_dien_thoai,
        input.email,
        input.trang_thai_tai_khoan,
        id,
      ],
    );
  }

  public async updatePassword(
    id: string,
    passwordHash: string,
    executor: DbExecutor = pool,
  ): Promise<void> {
    await executor.execute(
      'UPDATE `nguoi_dung` SET `mat_khau_ma_hoa` = ? WHERE `ma_nguoi_dung` = ?',
      [passwordHash, id],
    );
  }

  public async delete(id: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM `nguoi_dung` WHERE `ma_nguoi_dung` = ?',
      [id],
    );

    return result.affectedRows > 0;
  }

  public async hasReferences(id: string, executor: DbExecutor = pool): Promise<boolean> {
    const [rows] = await executor.execute<RowDataPacket[]>(
      `SELECT 1 FROM (
         SELECT \`ma_chuyen\` AS ref_id FROM \`chuyen_xe\` WHERE \`ma_tai_xe\` = ?
         UNION ALL
         SELECT \`ma_don_ve\` AS ref_id FROM \`don_dat_ve\` WHERE \`ma_khach_hang\` = ?
         UNION ALL
         SELECT \`ma_don_ve\` AS ref_id FROM \`don_dat_ve\` WHERE \`ma_nhan_vien_ban\` = ?
         UNION ALL
         SELECT \`ma_ve\` AS ref_id FROM \`chi_tiet_ve\` WHERE \`tai_xe_soat_ve\` = ?
       ) refs LIMIT 1`,
      [id, id, id, id],
    );

    return rows.length > 0;
  }
}
