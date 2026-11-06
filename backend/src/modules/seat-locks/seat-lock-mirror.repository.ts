import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import type { DbExecutor } from '../../db/types';
import { toDatabaseDateTime, toIsoUtc } from '../../utils/datetime';
import type { SeatLockMirrorEntry, SeatLockMirrorPort } from './seat-locks.types';

interface MirrorRow extends RowDataPacket {
  ma_chuyen: number;
  ky_hieu_ghe: string;
  ma_nguoi_dung: string;
  thoi_gian_het_han: string;
}

interface CountRow extends RowDataPacket {
  affected: string | number;
}

export class SeatLockMirrorRepository implements SeatLockMirrorPort {
  public constructor(private readonly executor: DbExecutor = pool) {}

  public async findActiveSeatCodes(tripId: number): Promise<Set<string>> {
    const [rows] = await this.executor.execute<MirrorRow[]>(
      `SELECT \`ma_chuyen\`, \`ky_hieu_ghe\`, \`ma_nguoi_dung\`, \`thoi_gian_het_han\`
       FROM \`giu_cho_tam_thoi\`
       WHERE \`ma_chuyen\` = ? AND \`thoi_gian_het_han\` > UTC_TIMESTAMP()`,
      [tripId],
    );

    return new Set(rows.map((row) => String(row.ky_hieu_ghe)));
  }

  public async findActiveEntries(tripId: number): Promise<SeatLockMirrorEntry[]> {
    const [rows] = await this.executor.execute<MirrorRow[]>(
      `SELECT \`ma_chuyen\`, \`ky_hieu_ghe\`, \`ma_nguoi_dung\`, \`thoi_gian_het_han\`
       FROM \`giu_cho_tam_thoi\`
       WHERE \`ma_chuyen\` = ? AND \`thoi_gian_het_han\` > UTC_TIMESTAMP()`,
      [tripId],
    );

    return rows.map((row) => ({
      ma_chuyen: Number(row.ma_chuyen),
      ky_hieu_ghe: String(row.ky_hieu_ghe),
      owner_ref: String(row.ma_nguoi_dung),
      expires_at: new Date(toIsoUtc(row.thoi_gian_het_han) ?? String(row.thoi_gian_het_han)),
    }));
  }

  public async upsertMany(entries: SeatLockMirrorEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const placeholders = entries.map(() => '(?, ?, ?, ?)').join(', ');
    const values = entries.flatMap((entry) => [
      entry.ma_chuyen,
      entry.ky_hieu_ghe,
      entry.owner_ref,
      toDatabaseDateTime(entry.expires_at),
    ]);

    await this.executor.execute(
      `INSERT INTO \`giu_cho_tam_thoi\`
        (\`ma_chuyen\`, \`ky_hieu_ghe\`, \`ma_nguoi_dung\`, \`thoi_gian_het_han\`)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         \`ma_nguoi_dung\` = VALUES(\`ma_nguoi_dung\`),
         \`thoi_gian_het_han\` = VALUES(\`thoi_gian_het_han\`)`,
      values,
    );
  }

  public async deleteMany(tripId: number, seatCodes: string[]): Promise<void> {
    if (seatCodes.length === 0) {
      return;
    }

    const placeholders = seatCodes.map(() => '?').join(', ');
    await this.executor.execute(
      `DELETE FROM \`giu_cho_tam_thoi\`
       WHERE \`ma_chuyen\` = ? AND \`ky_hieu_ghe\` IN (${placeholders})`,
      [tripId, ...seatCodes],
    );
  }

  public async deleteExpired(): Promise<number> {
    const [result] = await this.executor.execute<ResultSetHeader>(
      'DELETE FROM `giu_cho_tam_thoi` WHERE `thoi_gian_het_han` <= UTC_TIMESTAMP()',
    );

    return result.affectedRows;
  }

  public async countActive(executor: DbExecutor = this.executor): Promise<number> {
    const [rows] = await executor.execute<CountRow[]>(
      `SELECT COUNT(*) AS affected FROM \`giu_cho_tam_thoi\`
       WHERE \`thoi_gian_het_han\` > UTC_TIMESTAMP()`,
    );

    return Number(rows[0]?.affected ?? 0);
  }
}
