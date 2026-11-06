import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import { isRoleName, type RoleName } from '../../common/constants';
import { toIsoUtc } from '../../utils/datetime';
import type {
  AuthRepositoryPort,
  AuthUserRecord,
  CreateUserInput,
  RoleRecord,
  UpdateProfileRecord,
} from './auth.types';

interface UserRow extends RowDataPacket {
  ma_nguoi_dung: string;
  ma_vai_tro: number;
  ma_chi_nhanh: number | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string | null;
  mat_khau_ma_hoa: string;
  trang_thai_tai_khoan: string;
  thoi_gian_tao: string;
  ten_vai_tro: string;
}

interface RoleRow extends RowDataPacket {
  ma_vai_tro: number;
  ten_vai_tro: string;
}

const USER_SELECT = `
  SELECT
    u.\`ma_nguoi_dung\`,
    u.\`ma_vai_tro\`,
    u.\`ma_chi_nhanh\`,
    u.\`ho_va_ten\`,
    u.\`so_dien_thoai\`,
    u.\`email\`,
    u.\`mat_khau_ma_hoa\`,
    u.\`trang_thai_tai_khoan\`,
    u.\`thoi_gian_tao\`,
    v.\`ten_vai_tro\`
  FROM \`nguoi_dung\` u
  INNER JOIN \`vai_tro\` v ON v.\`ma_vai_tro\` = u.\`ma_vai_tro\`
`;

function mapUserRow(row: UserRow): AuthUserRecord {
  if (!isRoleName(row.ten_vai_tro)) {
    throw new Error(`Unknown role in database: ${row.ten_vai_tro}`);
  }

  return {
    ma_nguoi_dung: String(row.ma_nguoi_dung),
    ma_vai_tro: Number(row.ma_vai_tro),
    ma_chi_nhanh: row.ma_chi_nhanh === null ? null : Number(row.ma_chi_nhanh),
    ho_va_ten: String(row.ho_va_ten),
    so_dien_thoai: String(row.so_dien_thoai),
    email: row.email === null ? null : String(row.email),
    mat_khau_ma_hoa: String(row.mat_khau_ma_hoa),
    trang_thai_tai_khoan: String(row.trang_thai_tai_khoan),
    thoi_gian_tao: toIsoUtc(row.thoi_gian_tao) ?? String(row.thoi_gian_tao),
    ten_vai_tro: row.ten_vai_tro as RoleName,
  };
}

export class AuthRepository implements AuthRepositoryPort {
  public async findRoleByName(roleName: string): Promise<RoleRecord | null> {
    const [rows] = await pool.execute<RoleRow[]>(
      'SELECT `ma_vai_tro`, `ten_vai_tro` FROM `vai_tro` WHERE `ten_vai_tro` = ? LIMIT 1',
      [roleName],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    if (!isRoleName(row.ten_vai_tro)) {
      throw new Error(`Unknown role in database: ${row.ten_vai_tro}`);
    }

    return {
      ma_vai_tro: Number(row.ma_vai_tro),
      ten_vai_tro: row.ten_vai_tro,
    };
  }

  public async findUserByPhone(phone: string): Promise<AuthUserRecord | null> {
    const [rows] = await pool.execute<UserRow[]>(
      `${USER_SELECT} WHERE u.\`so_dien_thoai\` = ? LIMIT 1`,
      [phone],
    );

    const row = rows[0];
    return row ? mapUserRow(row) : null;
  }

  public async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const [rows] = await pool.execute<UserRow[]>(
      `${USER_SELECT} WHERE u.\`ma_nguoi_dung\` = ? LIMIT 1`,
      [userId],
    );

    const row = rows[0];
    return row ? mapUserRow(row) : null;
  }

  public async phoneExists(phone: string, excludeUserId?: string): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM \`nguoi_dung\` WHERE \`so_dien_thoai\` = ?${
        excludeUserId === undefined ? '' : ' AND `ma_nguoi_dung` <> ?'
      } LIMIT 1`,
      excludeUserId === undefined ? [phone] : [phone, excludeUserId],
    );

    return rows.length > 0;
  }

  public async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM \`nguoi_dung\` WHERE \`email\` = ?${
        excludeUserId === undefined ? '' : ' AND `ma_nguoi_dung` <> ?'
      } LIMIT 1`,
      excludeUserId === undefined ? [email] : [email, excludeUserId],
    );

    return rows.length > 0;
  }

  public async createUser(input: CreateUserInput): Promise<string> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO \`nguoi_dung\`
        (\`ma_vai_tro\`, \`ma_chi_nhanh\`, \`ho_va_ten\`, \`so_dien_thoai\`, \`email\`, \`mat_khau_ma_hoa\`, \`trang_thai_tai_khoan\`)
       VALUES (?, ?, ?, ?, ?, ?, 'HOAT_DONG')`,
      [
        input.ma_vai_tro,
        input.ma_chi_nhanh,
        input.ho_va_ten,
        input.so_dien_thoai,
        input.email,
        input.mat_khau_ma_hoa,
      ],
    );

    return String(result.insertId);
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await pool.execute('UPDATE `nguoi_dung` SET `mat_khau_ma_hoa` = ? WHERE `ma_nguoi_dung` = ?', [
      passwordHash,
      userId,
    ]);
  }

  public async updateProfile(userId: string, input: UpdateProfileRecord): Promise<void> {
    await pool.execute(
      'UPDATE `nguoi_dung` SET `ho_va_ten` = ?, `so_dien_thoai` = ?, `email` = ? WHERE `ma_nguoi_dung` = ?',
      [input.ho_va_ten, input.so_dien_thoai, input.email, userId],
    );
  }
}
