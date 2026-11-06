import { body, param, query, type ValidationChain } from 'express-validator';
import { VEHICLE_STATUSES } from './vehicles.types';

const statusValues = [...VEHICLE_STATUSES];

const vehicleBodyValidators: ValidationChain[] = [
  body('ma_loai_xe').isInt({ min: 1 }).withMessage('Loại xe không hợp lệ').toInt(),
  body('bien_so_xe')
    .trim()
    .isLength({ min: 4, max: 20 })
    .withMessage('Biển số xe phải có từ 4 đến 20 ký tự')
    .matches(/^[A-Za-z0-9][A-Za-z0-9 .-]*$/)
    .withMessage('Biển số xe chứa ký tự không hợp lệ'),
  body('hang_san_xuat')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 50 })
    .withMessage('Hãng sản xuất không được vượt quá 50 ký tự'),
  body('trang_thai')
    .optional()
    .isIn(statusValues)
    .withMessage(`Trạng thái xe phải là: ${statusValues.join(', ')}`),
];

export const listVehiclesValidators: ValidationChain[] = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('ma_loai_xe').optional().isInt({ min: 1 }).toInt(),
  query('trang_thai').optional().isIn(statusValues),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const createVehicleValidators: ValidationChain[] = vehicleBodyValidators;

export const updateVehicleValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
  ...vehicleBodyValidators,
];

export const vehicleIdValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
];
