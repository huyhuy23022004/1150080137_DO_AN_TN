import { Router, type RequestHandler } from 'express';
import { ROLES } from '../../common/constants';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createStatisticsController } from './statistics.controller';
import type { StatisticsService } from './statistics.service';
import { statisticsQueryValidators } from './statistics.validator';

const REPORT_ROLES = [
  ROLES.QUAN_TRI_VIEN,
  ROLES.DIEU_HANH,
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.NHAN_VIEN_PHONG_VE,
];

export function createStatisticsRouter(
  service: StatisticsService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  const controller = createStatisticsController(service);

  router.use(authenticate, requireRoles(...REPORT_ROLES));

  router.get('/revenue', ...validate(statisticsQueryValidators), controller.revenue);
  router.get(
    '/revenue/by-route',
    ...validate(statisticsQueryValidators),
    controller.revenueByRoute,
  );
  router.get(
    '/revenue/by-branch',
    ...validate(statisticsQueryValidators),
    controller.revenueByBranch,
  );

  return router;
}
