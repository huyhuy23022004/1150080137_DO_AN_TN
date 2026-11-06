import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { sendSuccess } from '../../common/response';
import type { StatisticsActor } from './statistics.types';
import type { StatisticsService } from './statistics.service';

export interface StatisticsController {
  revenue: RequestHandler;
  revenueByRoute: RequestHandler;
  revenueByBranch: RequestHandler;
}

function toActor(req: Request): StatisticsActor {
  const user = req.user;

  if (!user) {
    throw new Error('Statistics controller requires an authenticated request');
  }

  return {
    ten_vai_tro: user.ten_vai_tro,
    ma_chi_nhanh: user.ma_chi_nhanh,
  };
}

function parseQuery(req: Request): {
  tu_ngay?: unknown;
  den_ngay?: unknown;
  ma_chi_nhanh?: unknown;
  group_by?: unknown;
} {
  return {
    tu_ngay: req.query.tu_ngay,
    den_ngay: req.query.den_ngay,
    ma_chi_nhanh: req.query.ma_chi_nhanh,
    group_by: req.query.group_by,
  };
}

export function createStatisticsController(service: StatisticsService): StatisticsController {
  return {
    revenue: asyncHandler(async (req, res) => {
      const report = await service.getRevenue(toActor(req), parseQuery(req));
      sendSuccess(res, { bao_cao_doanh_thu: report });
    }),

    revenueByRoute: asyncHandler(async (req, res) => {
      const report = await service.getRevenueByRoute(toActor(req), parseQuery(req));
      sendSuccess(res, { bao_cao_doanh_thu_theo_tuyen: report });
    }),

    revenueByBranch: asyncHandler(async (req, res) => {
      const report = await service.getRevenueByBranch(toActor(req), parseQuery(req));
      sendSuccess(res, { bao_cao_doanh_thu_theo_chi_nhanh: report });
    }),
  };
}
