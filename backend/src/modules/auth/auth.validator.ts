import { body, type ValidationChain } from 'express-validator';
import { MAX_PASSWORD_BYTES } from '../../utils/password';
import { isValidVietnamesePhone, normalizeVietnamesePhone } from '../../utils/phone';

function passwordByteLengthIsValid(value: string): boolean {
  return Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES;
}

function phoneSanitizer(value: unknown): unknown {
  return typeof value === 'string' ? normalizeVietnamesePhone(value) : value;
}

function phoneIsValid(value: unknown): true {
  if (typeof value !== 'string' || !isValidVietnamesePhone(value)) {
    throw new Error('Số điện thoại không hợp lệ');
  }

  return true;
}

const phoneChain = (): ValidationChain =>
  body('so_dien_thoai').customSanitizer(phoneSanitizer).custom(phoneIsValid);

const passwordChain = (field: string): ValidationChain =>
  body(field)
    .isString()
    .withMessage('Mật khẩu phải là chuỗi')
    .isLength({ min: 8, max: MAX_PASSWORD_BYTES })
    .withMessage('Mật khẩu phải có từ 8 đến 72 ký tự')
    .custom((value: string) => {
      if (!passwordByteLengthIsValid(value)) {
        throw new Error('Mật khẩu không được vượt quá 72 byte');
      }

      return true;
    });

export const registerValidators: ValidationChain[] = [
  body('ho_va_ten')
    .trim()
    .notEmpty()
    .withMessage('Họ và tên không được để trống')
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
  passwordChain('mat_khau'),
  body('xac_nhan_mat_khau')
    .custom((value: unknown, { req }) => value === req.body.mat_khau)
    .withMessage('Xác nhận mật khẩu không khớp'),
];

export const loginValidators: ValidationChain[] = [
  phoneChain(),
  body('mat_khau').isString().notEmpty().withMessage('Mật khẩu không được để trống'),
];

export const changePasswordValidators: ValidationChain[] = [
  body('mat_khau_cu').isString().notEmpty().withMessage('Mật khẩu hiện tại không được để trống'),
  passwordChain('mat_khau_moi'),
  body('xac_nhan_mat_khau_moi')
    .custom((value: unknown, { req }) => value === req.body.mat_khau_moi)
    .withMessage('Xác nhận mật khẩu mới không khớp'),
];

export const updateProfileValidators: ValidationChain[] = [
  body('ho_va_ten')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ và tên phải có từ 2 đến 100 ký tự'),
  body('so_dien_thoai').optional().customSanitizer(phoneSanitizer).custom(phoneIsValid),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Email không hợp lệ')
    .isLength({ max: 100 })
    .withMessage('Email không được vượt quá 100 ký tự'),
  body().custom((_value: unknown, { req }) => {
    const bodyValue = req.body as Record<string, unknown>;
    if (
      bodyValue.ho_va_ten === undefined &&
      bodyValue.so_dien_thoai === undefined &&
      bodyValue.email === undefined
    ) {
      throw new Error('Cần cung cấp ít nhất một thông tin cần cập nhật');
    }

    return true;
  }),
];

export const refreshTokenValidators: ValidationChain[] = [
  body('refresh_token')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ min: 20, max: 5_000 })
    .withMessage('Refresh token không hợp lệ'),
];
