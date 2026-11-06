import { query, type ValidationChain } from 'express-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const statisticsQueryValidators: ValidationChain[] = [
  query('tu_ngay')
    .optional()
    .isString()
    .matches(DATE_PATTERN)
    .withMessage('tu_ngay phải có định dạng YYYY-MM-DD'),
  query('den_ngay')
    .optional()
    .isString()
    .matches(DATE_PATTERN)
    .withMessage('den_ngay phải có định dạng YYYY-MM-DD'),
  query('ma_chi_nhanh')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Mã chi nhánh không hợp lệ')
    .toInt(),
  query('group_by')
    .optional()
    .isIn(['day', 'month'])
    .withMessage('group_by chỉ nhận day hoặc month'),
];
