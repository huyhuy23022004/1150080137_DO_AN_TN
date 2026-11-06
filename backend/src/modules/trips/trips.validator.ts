import { body, param, query, type ValidationChain } from 'express-validator';
import { hasTimezoneOffset } from '../../utils/datetime';
import { TRIP_STATUS_VALUES } from './trips.types';

function isDateOnly(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTimedIso(value: unknown): boolean {
  if (typeof value !== 'string' || !hasTimezoneOffset(value)) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function validateDate(field: string): ValidationChain {
  return query(field)
    .optional()
    .custom((value: unknown) => {
      if (!isDateOnly(value)) {
        throw new Error(`${field} phải có định dạng YYYY-MM-DD`);
      }

      return true;
    });
}

const tripCoreBodyValidators: ValidationChain[] = [
  body('ma_tuyen').isInt({ min: 1 }).withMessage('Mã tuyến không hợp lệ').toInt(),
  body('ma_xe').isInt({ min: 1 }).withMessage('Mã xe không hợp lệ').toInt(),
  body('ma_tai_xe')
    .exists()
    .withMessage('Mã tài xế là bắt buộc')
    .bail()
    .custom((value: unknown) => {
      if (typeof value === 'string' && value.trim().length > 0 && value.length <= 36) {
        return true;
      }

      if (Number.isInteger(value) && Number(value) > 0) {
        return true;
      }

      throw new Error('Mã tài xế không hợp lệ');
    })
    .customSanitizer((value: unknown) => String(value).trim()),
  body('thoi_gian_xuat_ben').custom((value: unknown) => {
    if (!isTimedIso(value)) {
      throw new Error('Thời gian xuất bến phải là ISO 8601 có múi giờ');
    }

    return true;
  }),
  body('thoi_gian_den_du_kien').custom((value: unknown) => {
    if (!isTimedIso(value)) {
      throw new Error('Thời gian đến dự kiến phải là ISO 8601 có múi giờ');
    }

    return true;
  }),
  body('gia_ve_co_ban')
    .isFloat({ gt: 0, lt: 1_000_000_000 })
    .withMessage('Giá vé phải lớn hơn 0 và nhỏ hơn 1 tỷ'),
];

const tripStatusValidator: ValidationChain = body('trang_thai')
  .optional()
  .isIn([...TRIP_STATUS_VALUES])
  .withMessage(`Trạng thái chuyến phải là: ${TRIP_STATUS_VALUES.join(', ')}`);

const paginationValidators: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const searchTripsValidators: ValidationChain[] = [
  query('tinh_di').optional().isString().trim().isLength({ max: 100 }),
  query('tinh_den').optional().isString().trim().isLength({ max: 100 }),
  query('ma_tuyen').optional().isInt({ min: 1 }).toInt(),
  validateDate('ngay'),
  ...paginationValidators,
];

export const listTripsValidators: ValidationChain[] = [
  query('tinh_di').optional().isString().trim().isLength({ max: 100 }),
  query('tinh_den').optional().isString().trim().isLength({ max: 100 }),
  query('ma_tuyen').optional().isInt({ min: 1 }).toInt(),
  query('ma_xe').optional().isInt({ min: 1 }).toInt(),
  query('ma_tai_xe').optional().isString().trim().isLength({ max: 36 }),
  query('trang_thai')
    .optional()
    .isIn([...TRIP_STATUS_VALUES]),
  validateDate('tu_ngay'),
  validateDate('den_ngay'),
  ...paginationValidators,
];

export const listAssignedTripsValidators: ValidationChain[] = [
  query('trang_thai')
    .optional()
    .isIn([...TRIP_STATUS_VALUES])
    .withMessage(`Trạng thái chuyến phải là: ${TRIP_STATUS_VALUES.join(', ')}`),
  validateDate('tu_ngay'),
  validateDate('den_ngay'),
  ...paginationValidators,
];

export const createTripValidators: ValidationChain[] = [
  ...tripCoreBodyValidators,
  tripStatusValidator,
];

export const updateTripValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
  ...tripCoreBodyValidators,
];

export const updateTripStatusValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
  body('trang_thai')
    .isIn([...TRIP_STATUS_VALUES])
    .withMessage(`Trạng thái chuyến phải là: ${TRIP_STATUS_VALUES.join(', ')}`),
];

export const tripIdValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
];
