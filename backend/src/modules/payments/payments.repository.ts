import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import type { DbExecutor } from '../../db/types';
import { toIsoUtc } from '../../utils/datetime';
import type {
  PaymentOrderRecord,
  PaymentRepositoryPort,
  PaymentTransactionRecord,
} from './payments.types';

interface OrderRow extends RowDataPacket {
  ma_don_ve: string | number;
  ma_dinh_danh_don: string;
  ma_khach_hang: string | number | null;
  ma_chi_nhanh_ban: number | null;
  trang_thai_don: string;
  tong_tien: string;
  thoi_gian_tao: string;
}

interface IdRow extends RowDataPacket {
  ma_don_ve: string | number;
}

interface SeatRow extends RowDataPacket {
  ma_chuyen: number;
  ky_hieu_ghe: string;
}

interface PaymentRow extends RowDataPacket {
  ma_thanh_toan: string | number;
  ma_don_ve: string | number;
  phuong_thuc: string;
  ma_giao_dich_vnpay: string | null;
  so_tien: string;
  trang_thai: string;
}

const ORDER_COLUMNS = `
  \`ma_don_ve\`, \`ma_dinh_danh_don\`, \`ma_khach_hang\`, \`ma_chi_nhanh_ban\`,
  \`trang_thai_don\`, \`tong_tien\`, \`thoi_gian_tao\`
`;

export class PaymentRepository implements PaymentRepositoryPort {
  public async findOrderById(
    id: string,
    executor: DbExecutor = pool,
  ): Promise<PaymentOrderRecord | null> {
    const [rows] = await executor.execute<OrderRow[]>(
      `SELECT ${ORDER_COLUMNS} FROM \`don_dat_ve\` WHERE \`ma_don_ve\` = ? LIMIT 1`,
      [id],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const seats = await this.findOrderSeats(id, executor);

    return {
      ma_don_ve: String(row.ma_don_ve),
      ma_dinh_danh_don: String(row.ma_dinh_danh_don),
      ma_khach_hang: row.ma_khach_hang === null ? null : String(row.ma_khach_hang),
      ma_chi_nhanh_ban: row.ma_chi_nhanh_ban === null ? null : Number(row.ma_chi_nhanh_ban),
      trang_thai_don: String(row.trang_thai_don),
      tong_tien: String(row.tong_tien),
      thoi_gian_tao: toIsoUtc(row.thoi_gian_tao) ?? String(row.thoi_gian_tao),
      ma_chuyen: seats.ma_chuyen,
      danh_sach_ghe: seats.danh_sach_ghe,
    };
  }

  public async findOrderByIdentifier(
    code: string,
    executor: DbExecutor = pool,
  ): Promise<PaymentOrderRecord | null> {
    const [rows] = await executor.execute<IdRow[]>(
      'SELECT `ma_don_ve` FROM `don_dat_ve` WHERE `ma_dinh_danh_don` = ? LIMIT 1',
      [code],
    );

    const row = rows[0];
    return row ? this.findOrderById(String(row.ma_don_ve), executor) : null;
  }

  public async lockOrderByIdentifier(
    code: string,
    executor: DbExecutor,
  ): Promise<PaymentOrderRecord | null> {
    const [rows] = await executor.execute<IdRow[]>(
      'SELECT `ma_don_ve` FROM `don_dat_ve` WHERE `ma_dinh_danh_don` = ? LIMIT 1 FOR UPDATE',
      [code],
    );

    const row = rows[0];
    return row ? this.findOrderById(String(row.ma_don_ve), executor) : null;
  }

  public async findVnpayPayment(
    orderId: string,
    executor: DbExecutor = pool,
  ): Promise<PaymentTransactionRecord | null> {
    const [rows] = await executor.execute<PaymentRow[]>(
      `SELECT \`ma_thanh_toan\`, \`ma_don_ve\`, \`phuong_thuc\`, \`ma_giao_dich_vnpay\`,
              \`so_tien\`, \`trang_thai\`
       FROM \`thanh_toan\`
       WHERE \`ma_don_ve\` = ? AND \`phuong_thuc\` = 'VNPAY'
       ORDER BY \`ma_thanh_toan\` DESC
       LIMIT 1`,
      [orderId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      ma_thanh_toan: String(row.ma_thanh_toan),
      ma_don_ve: String(row.ma_don_ve),
      phuong_thuc: String(row.phuong_thuc),
      ma_giao_dich_vnpay: row.ma_giao_dich_vnpay === null ? null : String(row.ma_giao_dich_vnpay),
      so_tien: String(row.so_tien),
      trang_thai: String(row.trang_thai),
    };
  }

  public async markPaymentSuccess(
    input: {
      ma_thanh_toan: string;
      ma_giao_dich_vnpay: string;
      thong_tin_phan_hoi: string | null;
    },
    executor: DbExecutor,
  ): Promise<void> {
    await executor.execute<ResultSetHeader>(
      `UPDATE \`thanh_toan\`
       SET \`trang_thai\` = 'THANH_CONG',
           \`ma_giao_dich_vnpay\` = ?,
           \`thong_tin_phan_hoi\` = ?,
           \`thoi_gian_thanh_toan\` = UTC_TIMESTAMP()
       WHERE \`ma_thanh_toan\` = ?`,
      [input.ma_giao_dich_vnpay, input.thong_tin_phan_hoi, input.ma_thanh_toan],
    );
  }

  public async markPaymentFailed(
    input: { ma_thanh_toan: string; thong_tin_phan_hoi: string | null },
    executor: DbExecutor,
  ): Promise<void> {
    await executor.execute<ResultSetHeader>(
      `UPDATE \`thanh_toan\`
       SET \`trang_thai\` = 'THAT_BAI',
           \`thong_tin_phan_hoi\` = ?,
           \`thoi_gian_thanh_toan\` = NULL
       WHERE \`ma_thanh_toan\` = ? AND \`trang_thai\` <> 'THANH_CONG'`,
      [input.thong_tin_phan_hoi, input.ma_thanh_toan],
    );
  }

  public async markOrderPaid(orderId: string, executor: DbExecutor): Promise<void> {
    await executor.execute<ResultSetHeader>(
      `UPDATE \`don_dat_ve\`
       SET \`trang_thai_don\` = 'DA_THANH_TOAN'
       WHERE \`ma_don_ve\` = ? AND \`trang_thai_don\` = 'CHO_THANH_TOAN'`,
      [orderId],
    );
  }

  public async findOrderSeats(
    orderId: string,
    executor: DbExecutor = pool,
  ): Promise<{ ma_chuyen: number | null; danh_sach_ghe: string[] }> {
    const [rows] = await executor.execute<SeatRow[]>(
      `SELECT \`ma_chuyen\`, \`ky_hieu_ghe\`
       FROM \`chi_tiet_ve\`
       WHERE \`ma_don_ve\` = ? AND \`trang_thai_ve\` = 'HIEU_LUC'
       ORDER BY \`ma_ve\` ASC`,
      [orderId],
    );

    const first = rows[0];

    return {
      ma_chuyen: first ? Number(first.ma_chuyen) : null,
      danh_sach_ghe: rows.map((row) => String(row.ky_hieu_ghe)),
    };
  }
}
