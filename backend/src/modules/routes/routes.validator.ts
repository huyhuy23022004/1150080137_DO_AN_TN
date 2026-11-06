import { body, param, query, type ValidationChain } from 'express-validator';
import { STOP_TYPE_VALUES } from './routes.types';

function validateStops(value: unknown, required: boolean): boolean {
  if (value === undefined) {
    if (required) {
      throw new Error('Danh sách điểm dừng không được để trống');
    }

    return true;
  }

  if (!Array.isArray(value) || value.length < 2 || value.length > 50) {
    throw new Error('Tuyến đường phải có từ 2 đến 50 điểm dừng');
  }

  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Mỗi điểm dừng phải là một object');
    }

    const stop = item as Record<string, unknown>;
    if (typeof stop.ten_diem_dung !== 'string' || stop.ten_diem_dung.trim().length < 2) {
      throw new Error('Tên điểm dừng phải có ít nhất 2 ký tự');
    }

    if (
      typeof stop.loai_diem !== 'string' ||
      !(STOP_TYPE_VALUES as readonly string[]).includes(stop.loai_diem)
    ) {
      throw new Error('Loại điểm dừng phải là DON, TRA hoặc TRUNG_CHUYEN');
    }

    if (!Number.isInteger(stop.thu_tu_dung) || Number(stop.thu_tu_dung) < 1) {
      throw new Error('Thứ tự điểm dừng phải là số nguyên dương');
    }
  }

  return true;
}

const routeBodyValidators: ValidationChain[] = [
  body('ten_tuyen')
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Tên tuyến phải có từ 2 đến 150 ký tự'),
  body('tinh_di')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tỉnh đi phải có từ 2 đến 100 ký tự'),
  body('tinh_den')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tỉnh đến phải có từ 2 đến 100 ký tự'),
  body('khoang_cach_km')
    .isFloat({ gt: 0, lt: 10_000 })
    .withMessage('Khoảng cách phải lớn hơn 0 và nhỏ hơn 10000 km'),
  body('thoi_gian_chay_du_kien')
    .isInt({ min: 1, max: 10_000 })
    .withMessage('Thời gian chạy dự kiến phải từ 1 đến 10000 phút')
    .toInt(),
  body('trang_thai')
    .optional()
    .isBoolean()
    .withMessage('Trạng thái phải là true hoặc false')
    .toBoolean(),
];

export const listRoutesValidators: ValidationChain[] = [
  query('q').optional().isString().trim().isLength({ max: 150 }),
  query('tinh_di').optional().isString().trim().isLength({ max: 100 }),
  query('tinh_den').optional().isString().trim().isLength({ max: 100 }),
  query('trang_thai')
    .optional()
    .isIn(['all', 'true', 'false', 'HOAT_DONG', 'NGUNG_HOAT_DONG', '1', '0'])
    .withMessage('Trạng thái lọc không hợp lệ'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const createRouteValidators: ValidationChain[] = [
  ...routeBodyValidators,
  body('diem_dung').custom((value: unknown) => validateStops(value, true)),
];

export const updateRouteValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
  ...routeBodyValidators,
  body('diem_dung').custom((value: unknown) => validateStops(value, false)),
];

export const routeIdValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
];
