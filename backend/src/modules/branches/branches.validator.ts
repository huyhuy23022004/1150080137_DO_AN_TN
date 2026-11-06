import { body, param, query, type ValidationChain } from 'express-validator';

const branchBodyValidators: ValidationChain[] = [
  body('ma_dinh_danh')
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Mã định danh chi nhánh phải có từ 2 đến 20 ký tự')
    .matches(/^[A-Za-z0-9_]+$/)
    .withMessage('Mã định danh chỉ gồm chữ, số và dấu gạch dưới')
    .toUpperCase(),
  body('ten_chi_nhanh')
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Tên chi nhánh phải có từ 2 đến 150 ký tự'),
  body('so_dien_thoai')
    .trim()
    .matches(/^0\d{9,10}$/)
    .withMessage('Số điện thoại chi nhánh không hợp lệ'),
  body('dia_chi')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Địa chỉ chi nhánh phải có từ 2 đến 255 ký tự'),
  body('tinh_thanh')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tỉnh/thành phải có từ 2 đến 100 ký tự'),
  body('trang_thai_hoat_dong')
    .optional()
    .custom((value: unknown) => {
      if (typeof value === 'boolean' || value === '1' || value === '0') {
        return true;
      }

      const text = String(value).trim().toUpperCase();
      if (['TRUE', 'FALSE', 'HOAT_DONG', 'NGUNG_HOAT_DONG'].includes(text)) {
        return true;
      }

      throw new Error('Trạng thái hoạt động không hợp lệ');
    }),
];

export const listBranchesValidators: ValidationChain[] = [
  query('q').optional().isString().trim().isLength({ max: 150 }),
  query('tinh_thanh').optional().isString().trim().isLength({ max: 100 }),
  query('trang_thai_hoat_dong')
    .optional()
    .isIn(['all', 'true', 'false', 'HOAT_DONG', 'NGUNG_HOAT_DONG', '1', '0'])
    .withMessage('Trạng thái lọc không hợp lệ'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const createBranchValidators: ValidationChain[] = branchBodyValidators;

export const updateBranchValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
  ...branchBodyValidators,
];

export const branchIdValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ').toInt(),
];
