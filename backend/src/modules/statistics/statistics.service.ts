import { AppError } from '../../common/errors/AppError';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { ROLES, type RoleName } from '../../common/constants';
import { HTTP_STATUS } from '../../common/http-status';
import { vietnamDayRange } from '../../utils/datetime';
import type {
  RevenueBranchReport,
  RevenueFilters,
  RevenueRouteReport,
  RevenueTimeReport,
  StatisticsActor,
  StatisticsQuery,
  StatisticsRange,
  StatisticsRepositoryPort,
} from './statistics.types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const ALLOWED_ROLES: readonly RoleName[] = [
  ROLES.QUAN_TRI_VIEN,
  ROLES.DIEU_HANH,
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.NHAN_VIEN_PHONG_VE,
];

const BRANCH_BOUND_ROLES: readonly RoleName[] = [ROLES.QUAN_LY_CHI_NHANH, ROLES.NHAN_VIEN_PHONG_VE];

export interface StatisticsServiceDependencies {
  repository: StatisticsRepositoryPort;
  now?: () => Date;
}

interface ResolvedFilters {
  filters: RevenueFilters;
  range: StatisticsRange;
  group_by: 'day' | 'month';
}

function validationError(message: string): AppError {
  return new AppError(HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.VALIDATION_ERROR, message);
}

function forbiddenError(message: string): AppError {
  return new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, message);
}

function formatVietnamDate(value: Date): string {
  const shifted = new Date(value.getTime() + 7 * 60 * 60_000);
  const pad = (part: number): string => String(part).padStart(2, '0');

  return [shifted.getUTCFullYear(), pad(shifted.getUTCMonth() + 1), pad(shifted.getUTCDate())].join(
    '-',
  );
}

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00+07:00`);
  return formatVietnamDate(new Date(base.getTime() + days * DAY_MS));
}

export class StatisticsService {
  private readonly repository: StatisticsRepositoryPort;
  private readonly now: () => Date;

  public constructor(dependencies: StatisticsServiceDependencies) {
    this.repository = dependencies.repository;
    this.now = dependencies.now ?? (() => new Date());
  }

  public async getRevenue(
    actor: StatisticsActor,
    query: StatisticsQuery,
  ): Promise<RevenueTimeReport> {
    const resolved = this.resolveFilters(actor, query);

    const [summary, items] = await Promise.all([
      this.repository.summary(resolved.filters),
      this.repository.revenueByTime({
        ...resolved.filters,
        groupBy: resolved.group_by,
      }),
    ]);

    return {
      range: resolved.range,
      group_by: resolved.group_by,
      summary,
      items,
    };
  }

  public async getRevenueByRoute(
    actor: StatisticsActor,
    query: StatisticsQuery,
  ): Promise<RevenueRouteReport> {
    const resolved = this.resolveFilters(actor, query);
    const [summary, items] = await Promise.all([
      this.repository.summary(resolved.filters),
      this.repository.revenueByRoute(resolved.filters),
    ]);

    return {
      range: resolved.range,
      summary,
      items,
    };
  }

  public async getRevenueByBranch(
    actor: StatisticsActor,
    query: StatisticsQuery,
  ): Promise<RevenueBranchReport> {
    const resolved = this.resolveFilters(actor, query);
    const [summary, items] = await Promise.all([
      this.repository.summary(resolved.filters),
      this.repository.revenueByBranch(resolved.filters),
    ]);

    return {
      range: resolved.range,
      summary,
      items,
    };
  }

  private resolveFilters(actor: StatisticsActor, query: StatisticsQuery): ResolvedFilters {
    if (!ALLOWED_ROLES.includes(actor.ten_vai_tro)) {
      throw forbiddenError('Bạn không có quyền xem báo cáo doanh thu');
    }

    const today = formatVietnamDate(this.now());
    const denNgay = this.parseDate(query.den_ngay) ?? today;
    const tuNgay = this.parseDate(query.tu_ngay) ?? addDays(denNgay, -29);

    let startUtc: string;
    let endUtc: string;

    try {
      startUtc = vietnamDayRange(tuNgay).start;
      endUtc = vietnamDayRange(denNgay).end;
    } catch {
      throw validationError('Khoảng thời gian không hợp lệ');
    }

    if (startUtc >= endUtc) {
      throw validationError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
    }

    const requestedBranch = this.parseBranchId(query.ma_chi_nhanh);
    let branchId = requestedBranch;

    if (BRANCH_BOUND_ROLES.includes(actor.ten_vai_tro)) {
      if (actor.ma_chi_nhanh === null) {
        throw forbiddenError('Tài khoản chưa được gán chi nhánh');
      }

      if (requestedBranch !== null && requestedBranch !== actor.ma_chi_nhanh) {
        throw forbiddenError('Bạn chỉ được xem doanh thu của chi nhánh mình');
      }

      branchId = actor.ma_chi_nhanh;
    }

    return {
      filters: {
        startUtc,
        endUtc,
        branchId,
      },
      range: {
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        start_utc: startUtc,
        end_utc: endUtc,
      },
      group_by: this.parseGroupBy(query.group_by),
    };
  }

  private parseDate(value: unknown): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const text = String(value).trim();
    if (!DATE_PATTERN.test(text)) {
      throw validationError('Ngày phải có định dạng YYYY-MM-DD');
    }

    return text;
  }

  private parseBranchId(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw validationError('Mã chi nhánh không hợp lệ');
    }

    return parsed;
  }

  private parseGroupBy(value: unknown): 'day' | 'month' {
    if (value === undefined || value === null || value === '') {
      return 'day';
    }

    if (value === 'day' || value === 'month') {
      return value;
    }

    throw validationError('group_by chỉ nhận giá trị day hoặc month');
  }
}
