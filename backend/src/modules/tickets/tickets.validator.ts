import { body, param, query, type ValidationChain } from 'express-validator';
import { DON_DAT_VE_STATUS, TRANG_THAI_SOAT_VE } from '../../common/constants';

export const ticketIdValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('Mã vé không hợp lệ'),
];

export const tripPassengersValidators: ValidationChain[] = [
  param('tripId').isInt({ min: 1 }).withMessage('Mã chuyến không hợp lệ'),
];

export const checkinValidators: ValidationChain[] = [
  body('ma_qr')
    .isString()
    .trim()
    .isLength({ min: 10, max: 1_000 })
    .withMessage('Mã QR không hợp lệ'),
];

export const listMyTicketsValidators: ValidationChain[] = [
  query('trang_thai_soat_ve')
    .optional()
    .isIn(Object.values(TRANG_THAI_SOAT_VE))
    .withMessage('Trạng thái soát vé không hợp lệ'),
  query('trang_thai_don')
    .optional()
    .isIn(Object.values(DON_DAT_VE_STATUS))
    .withMessage('Trạng thái đơn không hợp lệ'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
