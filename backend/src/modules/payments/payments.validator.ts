import { body, type ValidationChain } from 'express-validator';

export const createVnpayUrlValidators: ValidationChain[] = [
  body('ma_don_ve')
    .custom((value: unknown) => /^\d+$/.test(String(value ?? '')))
    .withMessage('Mã đơn đặt vé không hợp lệ'),
];
