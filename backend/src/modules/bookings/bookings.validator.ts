import { body, header, param, query, type ValidationChain } from 'express-validator';
import { DON_DAT_VE_STATUS, PHUONG_THUC_THANH_TOAN } from '../../common/constants';

function isValidSeatList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 20 &&
    value.every((seat) => typeof seat === 'string' && /^[A-Za-z0-9_-]{1,10}$/.test(seat.trim()))
  );
}

const seatListValidator: ValidationChain = body('danh_sach_ghe')
  .custom((value: unknown) => {
    if (!isValidSeatList(value)) {
      throw new Error('Danh sách ghế không hợp lệ');
    }

    return true;
  })
  .customSanitizer((value: unknown) =>
    Array.from(new Set((value as string[]).map((seat) => seat.trim().toUpperCase()))),
  );

export const quoteBookingValidators: ValidationChain[] = [
  body('ma_chuyen').isInt({ min: 1 }).withMessage('Mã chuyến không hợp lệ').toInt(),
  seatListValidator,
];

export const createBookingValidators: ValidationChain[] = [
  body('ma_chuyen').isInt({ min: 1 }).withMessage('Mã chuyến không hợp lệ').toInt(),
  body('owner_ref')
    .isString()
    .trim()
    .matches(/^[A-Za-z0-9_-]{8,50}$/)
    .withMessage('owner_ref không hợp lệ'),
  seatListValidator,
  body('ma_diem_don').isInt({ min: 1 }).withMessage('Điểm đón không hợp lệ').toInt(),
  body('ma_diem_tra').isInt({ min: 1 }).withMessage('Điểm trả không hợp lệ').toInt(),
  body('ho_ten_khach')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Họ tên khách tối đa 100 ký tự'),
  body('so_dien_thoai_khach')
    .optional({ nullable: true })
    .isString()
    .trim()
    .matches(/^0\d{9,10}$/)
    .withMessage('Số điện thoại khách không hợp lệ'),
  body('email_khach')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Email khách không hợp lệ')
    .isLength({ max: 100 }),
  body('phuong_thuc_thanh_toan')
    .optional()
    .isIn(Object.values(PHUONG_THUC_THANH_TOAN))
    .withMessage('Phương thức thanh toán không hợp lệ'),
  body('idempotency_key')
    .optional({ nullable: true })
    .isString()
    .trim()
    .matches(/^[A-Za-z0-9._:-]{1,100}$/)
    .withMessage('Idempotency key không hợp lệ'),
  header('Idempotency-Key')
    .optional()
    .isString()
    .trim()
    .matches(/^[A-Za-z0-9._:-]{1,100}$/)
    .withMessage('Idempotency-Key không hợp lệ'),
];

export const bookingIdValidators: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID đơn đặt vé không hợp lệ'),
];

export const bookingCodeValidators: ValidationChain[] = [
  param('code')
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Mã đơn đặt vé không hợp lệ')
    .matches(/^[A-Za-z0-9-]+$/)
    .withMessage('Mã đơn đặt vé không hợp lệ'),
];

export const listBookingValidators: ValidationChain[] = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('ma_dinh_danh_don')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[A-Za-z0-9-]+$/)
    .withMessage('Mã đơn đặt vé không hợp lệ'),
  query('so_dien_thoai_khach')
    .optional()
    .isString()
    .trim()
    .matches(/^0\d{9,10}$/)
    .withMessage('Số điện thoại khách không hợp lệ'),
  query('ma_chuyen').optional().isInt({ min: 1 }).withMessage('Mã chuyến không hợp lệ').toInt(),
  query('ma_chi_nhanh')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Mã chi nhánh không hợp lệ')
    .toInt(),
  query('trang_thai_don')
    .optional()
    .isIn(Object.values(DON_DAT_VE_STATUS))
    .withMessage('Trạng thái đơn đặt vé không hợp lệ'),
  query('tu_ngay')
    .optional()
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('tu_ngay phải có định dạng YYYY-MM-DD'),
  query('den_ngay')
    .optional()
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('den_ngay phải có định dạng YYYY-MM-DD'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
