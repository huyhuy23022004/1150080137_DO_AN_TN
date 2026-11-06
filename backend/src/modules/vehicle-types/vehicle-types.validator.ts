import { body, param, query, type ValidationChain } from 'express-validator';
import { SEAT_TYPES } from './vehicle-types.types';

function validateSeatLayout(value: unknown, required: boolean): boolean {
  if (value === undefined) {
    if (required) {
      throw new Error('Sơ đồ ghế không được để trống');
    }

    return true;
  }

  if (!Array.isArray(value) || value.length === 0 || value.length > 200) {
    throw new Error('Sơ đồ ghế phải là mảng có từ 1 đến 200 ghế');
  }

  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Mỗi ghế phải là một object');
    }

    const seat = item as Record<string, unknown>;
    if (
      typeof seat.ky_hieu_ghe !== 'string' ||
      !/^[A-Za-z0-9_-]{1,10}$/.test(seat.ky_hieu_ghe.trim())
    ) {
      throw new Error('Ký hiệu ghế phải có từ 1 đến 10 ký tự chữ, số, gạch ngang hoặc gạch dưới');
    }

    for (const field of ['tang', 'hang', 'cot']) {
      if (!Number.isInteger(seat[field]) || Number(seat[field]) < 1) {
        throw new Error(`${field} của ghế phải là số nguyên dương`);
      }
    }

    if (seat.loai_cho !== SEAT_TYPES.THUONG && seat.loai_cho !== SEAT_TYPES.VIP) {
      throw new Error('loai_cho phải là THUONG hoặc VIP');
    }
  }

  return true;
}

export const listVehicleTypesValidators: ValidationChain[] = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const createVehicleTypeValidators: ValidationChain[] = [
  body('ten_loai_xe')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên loại xe phải có từ 2 đến 100 ký tự'),
  body('so_tang').isInt({ min: 1, max: 3 }).withMessage('Số tầng phải từ 1 đến 3').toInt(),
  body('so_do_ghe').custom((value: unknown) => validateSeatLayout(value, true)),
];

export const updateVehicleTypeValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
  body('ten_loai_xe')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên loại xe phải có từ 2 đến 100 ký tự'),
  body('so_tang').isInt({ min: 1, max: 3 }).withMessage('Số tầng phải từ 1 đến 3').toInt(),
  body('so_do_ghe').custom((value: unknown) => validateSeatLayout(value, false)),
];

export const vehicleTypeIdValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
];
