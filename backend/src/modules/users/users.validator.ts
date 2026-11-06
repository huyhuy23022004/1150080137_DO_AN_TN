import { body, param, query, type ValidationChain } from 'express-validator';
import { ACCOUNT_STATUS } from '../../common/constants';
import { MAX_PASSWORD_BYTES } from '../../utils/password';
import { isValidVietnamesePhone, normalizeVietnamesePhone } from '../../utils/phone';

const phoneChain = (): ValidationChain =>
  body('so_dien_thoai')
    .customSanitizer((value: unknown) => {
      return typeof value === 'string' ? normalizeVietnamesePhone(value) : value;
    })
    .custom((value: unknown) => {
      if (typeof value !== 'string' || !isValidVietnamesePhone(value)) {
        throw new Error('Số điện thoại không hợp lệ');
      }

      return true;
    });

const passwordChain = (field: string): ValidationChain =>
  body(field)
    .isString()
    .withMessage('Mật khẩu phải là chuỗi')
    .isLength({ min: 8, max: MAX_PASSWORD_BYTES })
    .withMessage('Mật khẩu phải có từ 8 đến 72 ký tự')
    .custom((value: string) => {
      if (Buffer.byteLength(value, 'utf8') > MAX_PASSWORD_BYTES) {
        throw new Error('Mật khẩu không được vượt quá 72 byte');
      }

      return true;
    });

const userIdValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID người dùng không hợp lệ'),
];

const userBodyValidators: ValidationChain[] = [
  body('ma_vai_tro').isInt({ min: 1 }).withMessage('Vai trò không hợp lệ').toInt(),
  body('ma_chi_nhanh')
    .optional({ values: 'null' })
    .isInt({ min: 1 })
    .withMessage('Chi nhánh không hợp lệ')
    .toInt(),
  body('ho_va_ten')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ và tên phải có từ 2 đến 100 ký tự'),
  phoneChain(),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Email không hợp lệ')
    .isLength({ max: 100 })
    .withMessage('Email không được vượt quá 100 ký tự'),
  body('trang_thai_tai_khoan')
    .optional()
    .isIn([ACCOUNT_STATUS.HOAT_DONG, ACCOUNT_STATUS.KHOA])
    .withMessage('Trạng thái tài khoản phải là HOAT_DONG hoặc KHOA'),
];

export const listUsersValidators: ValidationChain[] = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('ma_vai_tro').optional().isInt({ min: 1 }).toInt(),
  query('ma_chi_nhanh').optional().isInt({ min: 1 }).toInt(),
  query('trang_thai_tai_khoan').optional().isIn([ACCOUNT_STATUS.HOAT_DONG, ACCOUNT_STATUS.KHOA]),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const createUserValidators: ValidationChain[] = [
  ...userBodyValidators,
  passwordChain('mat_khau'),
];

export const updateUserValidators: ValidationChain[] = [...userIdValidators, ...userBodyValidators];

export const updateUserStatusValidators: ValidationChain[] = [
  ...userIdValidators,
  body('trang_thai_tai_khoan')
    .isIn([ACCOUNT_STATUS.HOAT_DONG, ACCOUNT_STATUS.KHOA])
    .withMessage('Trạng thái tài khoản phải là HOAT_DONG hoặc KHOA'),
];

export const resetUserPasswordValidators: ValidationChain[] = [
  ...userIdValidators,
  passwordChain('mat_khau_moi'),
];

export const userIdOnlyValidators: ValidationChain[] = userIdValidators;
