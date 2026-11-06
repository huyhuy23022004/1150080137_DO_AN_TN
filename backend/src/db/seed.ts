import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql, { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { config } from '../config/env';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { isDuplicateEntryError } from '../common/errors/db-errors';
import { PasswordService } from '../utils/password';
import { normalizeVietnamesePhone, isValidVietnamesePhone } from '../utils/phone';
import { toDatabaseDateTime } from '../utils/datetime';

const SEEDS_DIR = path.resolve(__dirname, '../../database/seeds');

const DEMO_USERS = [
  {
    phone: '0901000001',
    name: 'Nguyễn Văn Tài',
    role: 'TAI_XE',
    branch: 'PV_MIEN_TAY',
  },
  {
    phone: '0901000002',
    name: 'Trần Minh Phúc',
    role: 'TAI_XE',
    branch: 'PV_DA_LAT',
  },
  {
    phone: '0901000003',
    name: 'Lê Thu Hà',
    role: 'QUAN_LY_CHI_NHANH',
    branch: 'PV_MIEN_TAY',
  },
  {
    phone: '0901000004',
    name: 'Nguyễn Thị Mai',
    role: 'NHAN_VIEN_PHONG_VE',
    branch: 'PV_MIEN_TAY',
  },
  {
    phone: '0901000005',
    name: 'Phạm Quốc Bảo',
    role: 'NHAN_VIEN_PHONG_VE',
    branch: 'PV_LE_HONG_PHONG',
  },
  {
    phone: '0901000006',
    name: 'Đỗ Minh Khoa',
    role: 'DIEU_HANH',
    branch: 'PV_MIEN_TAY',
  },
  {
    phone: '0901000007',
    name: 'Nguyễn Hoàng Anh',
    role: 'KHACH_HANG',
    branch: null,
  },
] as const;

interface RoleRow extends RowDataPacket {
  ma_vai_tro: number;
}

interface UserRow extends RowDataPacket {
  ma_nguoi_dung: string;
}

async function runSeedFiles(): Promise<void> {
  const entries = await readdir(SEEDS_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    logger.warn({ directory: SEEDS_DIR }, 'no_seed_files_found');
    return;
  }

  const runner = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    charset: 'utf8mb4_unicode_ci',
    multipleStatements: true,
    connectTimeout: 10_000,
  });

  try {
    for (const file of files) {
      const sql = await readFile(path.join(SEEDS_DIR, file), 'utf8');
      await runner.query(sql);
      logger.info({ seed: file }, 'seed_applied');
    }
  } finally {
    await runner.end();
  }
}

async function seedAdmin(): Promise<void> {
  const adminPhone = config.admin.phone;
  const adminPassword = config.admin.password;

  if (!adminPhone || !adminPassword) {
    logger.warn('admin_seed_skipped_missing_ADMIN_PHONE_or_ADMIN_PASSWORD');
    return;
  }

  const normalizedPhone = normalizeVietnamesePhone(adminPhone);
  if (!isValidVietnamesePhone(normalizedPhone)) {
    throw new Error('ADMIN_PHONE is not a valid Vietnamese phone number');
  }

  const [roleRows] = await pool.execute<RoleRow[]>(
    'SELECT `ma_vai_tro` FROM `vai_tro` WHERE `ten_vai_tro` = ? LIMIT 1',
    ['QUAN_TRI_VIEN'],
  );

  const role = roleRows[0];
  if (!role) {
    throw new Error('Role QUAN_TRI_VIEN not found. Run migrations and base seed first.');
  }

  const [existingRows] = await pool.execute<UserRow[]>(
    'SELECT `ma_nguoi_dung` FROM `nguoi_dung` WHERE `so_dien_thoai` = ? LIMIT 1',
    [normalizedPhone],
  );

  if (existingRows.length > 0) {
    logger.info({ phone: normalizedPhone }, 'admin_seed_already_exists');
    return;
  }

  const passwordService = new PasswordService(config.security.saltRounds);
  const passwordHash = await passwordService.hash(adminPassword);

  try {
    await pool.execute(
      `INSERT INTO \`nguoi_dung\`
        (\`ma_vai_tro\`, \`ma_chi_nhanh\`, \`ho_va_ten\`, \`so_dien_thoai\`, \`email\`, \`mat_khau_ma_hoa\`, \`trang_thai_tai_khoan\`)
       VALUES (?, NULL, ?, ?, NULL, ?, 'HOAT_DONG')`,
      [role.ma_vai_tro, 'Quản trị viên hệ thống', normalizedPhone, passwordHash],
    );
    logger.info({ phone: normalizedPhone }, 'admin_seed_created');
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      logger.info({ phone: normalizedPhone }, 'admin_seed_already_exists');
      return;
    }

    throw error;
  }
}

async function findId(sql: string, params: Array<string | number>): Promise<number | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
  const row = rows[0];
  return row ? Number(row.ma_nguoi_dung ?? row.ma_vai_tro ?? row.ma_chi_nhanh ?? row.ma_xe) : null;
}

async function ensureDemoUser(
  input: (typeof DEMO_USERS)[number],
  passwordHash: string,
): Promise<string | null> {
  const [existingRows] = await pool.execute<UserRow[]>(
    'SELECT `ma_nguoi_dung` FROM `nguoi_dung` WHERE `so_dien_thoai` = ? LIMIT 1',
    [input.phone],
  );

  if (existingRows[0]) {
    return String(existingRows[0].ma_nguoi_dung);
  }

  const roleId = await findId(
    'SELECT `ma_vai_tro` FROM `vai_tro` WHERE `ten_vai_tro` = ? LIMIT 1',
    [input.role],
  );
  const branchId =
    input.branch === null
      ? null
      : await findId('SELECT `ma_chi_nhanh` FROM `chi_nhanh` WHERE `ma_dinh_danh` = ? LIMIT 1', [
          input.branch,
        ]);

  if (roleId === null || (input.branch !== null && branchId === null)) {
    logger.warn({ phone: input.phone }, 'demo_user_seed_skipped_missing_role_or_branch');
    return null;
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO \`nguoi_dung\`
      (\`ma_vai_tro\`, \`ma_chi_nhanh\`, \`ho_va_ten\`, \`so_dien_thoai\`, \`email\`,
       \`mat_khau_ma_hoa\`, \`trang_thai_tai_khoan\`)
     VALUES (?, ?, ?, ?, NULL, ?, 'HOAT_DONG')`,
    [roleId, branchId, input.name, input.phone, passwordHash],
  );

  logger.info({ phone: input.phone, role: input.role }, 'demo_user_seed_created');
  return String(result.insertId);
}

function upcomingVietnamTime(daysAhead: number, hour: number): Date {
  const vietnamNow = new Date(Date.now() + 7 * 3_600_000);
  vietnamNow.setUTCDate(vietnamNow.getUTCDate() + daysAhead);
  vietnamNow.setUTCHours(hour, 0, 0, 0);
  return new Date(vietnamNow.getTime() - 7 * 3_600_000);
}

async function seedDemoData(): Promise<void> {
  if (!config.seedDemoData) {
    logger.info('demo_seed_skipped_disabled');
    return;
  }

  const demoPassword = config.admin.password;
  if (!demoPassword) {
    logger.warn('demo_seed_skipped_missing_ADMIN_PASSWORD');
    return;
  }

  const passwordService = new PasswordService(config.security.saltRounds);
  const passwordHash = await passwordService.hash(demoPassword);
  const userIds = new Map<string, string>();

  for (const demoUser of DEMO_USERS) {
    const id = await ensureDemoUser(demoUser, passwordHash);
    if (id !== null) {
      userIds.set(demoUser.phone, id);
    }
  }

  const driverIds = [userIds.get(DEMO_USERS[0].phone), userIds.get(DEMO_USERS[1].phone)].filter(
    (id): id is string => id !== undefined,
  );

  const [vehicleRows] = await pool.execute<RowDataPacket[]>(
    'SELECT `ma_xe` FROM `xe` WHERE `trang_thai` = ? ORDER BY `ma_xe` ASC',
    ['HOAT_DONG'],
  );
  const [routeRows] = await pool.execute<RowDataPacket[]>(
    'SELECT `ma_tuyen` FROM `tuyen_duong` WHERE `trang_thai` = TRUE ORDER BY `ma_tuyen` ASC',
  );

  const vehicleIds = vehicleRows.map((row) => Number(row.ma_xe));
  const routeId = routeRows[0] ? Number(routeRows[0].ma_tuyen) : null;

  if (driverIds.length === 0 || vehicleIds.length === 0 || routeId === null) {
    logger.warn('demo_trip_seed_skipped_missing_driver_vehicle_or_route');
    return;
  }

  const trips = [
    { daysAhead: 1, hour: 8, durationHours: 6.5, price: '320000.00' },
    { daysAhead: 1, hour: 20, durationHours: 6.5, price: '300000.00' },
    { daysAhead: 2, hour: 8, durationHours: 6.5, price: '340000.00' },
  ];

  for (const [index, trip] of trips.entries()) {
    const start = upcomingVietnamTime(trip.daysAhead, trip.hour);
    const end = new Date(start.getTime() + trip.durationHours * 3_600_000);
    const startDb = toDatabaseDateTime(start);
    const endDb = toDatabaseDateTime(end);
    const vehicleId = vehicleIds[index % vehicleIds.length];
    const driverId = driverIds[index % driverIds.length];

    if (vehicleId === undefined || driverId === undefined) {
      continue;
    }

    const [conflicts] = await pool.execute<RowDataPacket[]>(
      `SELECT \`ma_chuyen\`
       FROM \`chuyen_xe\`
       WHERE (\`ma_xe\` = ? OR \`ma_tai_xe\` = ?)
         AND \`trang_thai\` <> 'HUY'
         AND \`thoi_gian_xuat_ben\` < ?
         AND \`thoi_gian_den_du_kien\` > ?
       LIMIT 1`,
      [vehicleId, driverId, endDb, startDb],
    );

    if (conflicts[0]) {
      logger.info({ start: startDb, vehicleId, driverId }, 'demo_trip_seed_skipped_conflict');
      continue;
    }

    const [existingRows] = await pool.execute<RowDataPacket[]>(
      `SELECT \`ma_chuyen\` FROM \`chuyen_xe\`
       WHERE \`ma_tuyen\` = ? AND \`ma_xe\` = ? AND \`ma_tai_xe\` = ?
         AND \`thoi_gian_xuat_ben\` = ? LIMIT 1`,
      [routeId, vehicleId, driverId, startDb],
    );

    if (existingRows[0]) {
      logger.info({ start: startDb }, 'demo_trip_seed_already_exists');
      continue;
    }

    await pool.execute(
      `INSERT INTO \`chuyen_xe\`
        (\`ma_tuyen\`, \`ma_xe\`, \`ma_tai_xe\`, \`thoi_gian_xuat_ben\`, \`thoi_gian_den_du_kien\`,
         \`gia_ve_co_ban\`, \`trang_thai\`)
       VALUES (?, ?, ?, ?, ?, ?, 'SAP_CHAY')`,
      [routeId, vehicleId, driverId, startDb, endDb, trip.price],
    );

    logger.info({ start: startDb, vehicleId, driverId }, 'demo_trip_seed_created');
  }
}

async function main(): Promise<void> {
  try {
    await runSeedFiles();
    await seedAdmin();
    await seedDemoData();
    logger.info('seed_completed');
  } catch (error) {
    logger.fatal({ err: error }, 'seed_failed');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
