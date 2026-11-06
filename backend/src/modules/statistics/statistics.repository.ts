import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database';
import type {
  RevenueBranchItem,
  RevenueFilters,
  RevenueRouteItem,
  RevenueSummary,
  RevenueTimeFilters,
  RevenueTimeItem,
  StatisticsRepositoryPort,
} from './statistics.types';

interface SummaryRow extends RowDataPacket {
  tong_doanh_thu: string;
  so_don: string | number;
  so_ve: string | number;
  so_ve_da_soat: string | number;
}

interface TimeRow extends RowDataPacket {
  ky: string;
  tong_doanh_thu: string;
  so_don: string | number;
  so_ve: string | number;
  so_ve_da_soat: string | number;
}

interface RouteRow extends RowDataPacket {
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  tong_doanh_thu: string;
  so_don: string | number;
  so_ve: string | number;
  so_ve_da_soat: string | number;
}

interface BranchRow extends RowDataPacket {
  ma_chi_nhanh: number | null;
  ten_chi_nhanh: string | null;
  tong_doanh_thu: string;
  so_don: string | number;
  so_ve: string | number;
  so_ve_da_soat: string | number;
}

const PAID_JOIN = `
  FROM \`chi_tiet_ve\` ct
  INNER JOIN \`don_dat_ve\` d ON d.\`ma_don_ve\` = ct.\`ma_don_ve\`
`;

const PAID_FILTER = `
  WHERE d.\`trang_thai_don\` = 'DA_THANH_TOAN'
    AND ct.\`trang_thai_ve\` = 'HIEU_LUC'
    AND d.\`thoi_gian_tao\` >= ?
    AND d.\`thoi_gian_tao\` < ?
`;

const TICKET_METRICS = `
  COALESCE(SUM(ct.\`gia_ve\`), 0) AS \`tong_doanh_thu\`,
  COUNT(DISTINCT d.\`ma_don_ve\`) AS \`so_don\`,
  COUNT(*) AS \`so_ve\`,
  COALESCE(
    SUM(CASE WHEN ct.\`trang_thai_soat_ve\` = 'DA_LEN_XE' THEN 1 ELSE 0 END),
    0
  ) AS \`so_ve_da_soat\`
`;

function buildFilter(
  filters: RevenueFilters,
  alias = 'd',
): { whereSql: string; params: Array<string | number> } {
  const params: Array<string | number> = [filters.startUtc, filters.endUtc];
  let whereSql = PAID_FILTER.replace('d.', `${alias}.`);

  if (filters.branchId !== null) {
    whereSql += ` AND ${alias}.\`ma_chi_nhanh_ban\` = ?`;
    params.push(filters.branchId);
  }

  return { whereSql, params };
}

function mapSummary(row: SummaryRow | undefined): RevenueSummary {
  return {
    tong_doanh_thu: String(row?.tong_doanh_thu ?? '0'),
    so_don: Number(row?.so_don ?? 0),
    so_ve: Number(row?.so_ve ?? 0),
    so_ve_da_soat: Number(row?.so_ve_da_soat ?? 0),
  };
}

export class StatisticsRepository implements StatisticsRepositoryPort {
  public async summary(filters: RevenueFilters): Promise<RevenueSummary> {
    const { whereSql, params } = buildFilter(filters);

    const [rows] = await pool.execute<SummaryRow[]>(
      `SELECT ${TICKET_METRICS} ${PAID_JOIN} ${whereSql}`,
      params,
    );

    return mapSummary(rows[0]);
  }

  public async revenueByTime(filters: RevenueTimeFilters): Promise<RevenueTimeItem[]> {
    const { whereSql, params } = buildFilter(filters);
    const dateFormat = filters.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const [rows] = await pool.execute<TimeRow[]>(
      `SELECT DATE_FORMAT(DATE_ADD(d.\`thoi_gian_tao\`, INTERVAL 7 HOUR), ?) AS \`ky\`,
              ${TICKET_METRICS}
       ${PAID_JOIN} ${whereSql}
       GROUP BY \`ky\`
       ORDER BY \`ky\` ASC`,
      [dateFormat, ...params],
    );

    return rows.map((row) => ({
      ky: String(row.ky),
      tong_doanh_thu: String(row.tong_doanh_thu),
      so_don: Number(row.so_don),
      so_ve: Number(row.so_ve),
      so_ve_da_soat: Number(row.so_ve_da_soat),
    }));
  }

  public async revenueByRoute(filters: RevenueFilters): Promise<RevenueRouteItem[]> {
    const { whereSql, params } = buildFilter(filters);

    const [rows] = await pool.execute<RouteRow[]>(
      `SELECT t.\`ma_tuyen\`, t.\`ten_tuyen\`, t.\`tinh_di\`, t.\`tinh_den\`,
              ${TICKET_METRICS}
       ${PAID_JOIN}
       INNER JOIN \`chuyen_xe\` c ON c.\`ma_chuyen\` = ct.\`ma_chuyen\`
       INNER JOIN \`tuyen_duong\` t ON t.\`ma_tuyen\` = c.\`ma_tuyen\`
       ${whereSql}
       GROUP BY t.\`ma_tuyen\`, t.\`ten_tuyen\`, t.\`tinh_di\`, t.\`tinh_den\`
       ORDER BY \`tong_doanh_thu\` DESC, t.\`ten_tuyen\` ASC`,
      params,
    );

    return rows.map((row) => ({
      ma_tuyen: Number(row.ma_tuyen),
      ten_tuyen: String(row.ten_tuyen),
      tinh_di: String(row.tinh_di),
      tinh_den: String(row.tinh_den),
      tong_doanh_thu: String(row.tong_doanh_thu),
      so_don: Number(row.so_don),
      so_ve: Number(row.so_ve),
      so_ve_da_soat: Number(row.so_ve_da_soat),
    }));
  }

  public async revenueByBranch(filters: RevenueFilters): Promise<RevenueBranchItem[]> {
    const { whereSql, params } = buildFilter(filters);

    const [rows] = await pool.execute<BranchRow[]>(
      `SELECT d.\`ma_chi_nhanh_ban\` AS \`ma_chi_nhanh\`,
              cn.\`ten_chi_nhanh\`,
              ${TICKET_METRICS}
       ${PAID_JOIN}
       LEFT JOIN \`chi_nhanh\` cn ON cn.\`ma_chi_nhanh\` = d.\`ma_chi_nhanh_ban\`
       ${whereSql}
       GROUP BY d.\`ma_chi_nhanh_ban\`, cn.\`ten_chi_nhanh\`
       ORDER BY \`tong_doanh_thu\` DESC, cn.\`ten_chi_nhanh\` ASC`,
      params,
    );

    return rows.map((row) => ({
      ma_chi_nhanh: row.ma_chi_nhanh === null ? null : Number(row.ma_chi_nhanh),
      ten_chi_nhanh: row.ten_chi_nhanh === null ? 'Kênh trực tuyến' : String(row.ten_chi_nhanh),
      tong_doanh_thu: String(row.tong_doanh_thu),
      so_don: Number(row.so_don),
      so_ve: Number(row.so_ve),
      so_ve_da_soat: Number(row.so_ve_da_soat),
    }));
  }
}
