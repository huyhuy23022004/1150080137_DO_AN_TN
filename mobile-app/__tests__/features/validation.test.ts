import {
  hasFieldErrors,
  normalizeVietnamesePhone,
  validateEmail,
  validateLogin,
  validatePassword,
  validatePhone,
  validateRegister,
} from '../../src/features/auth/validation';

describe('auth validation', () => {
  it('normalizes common Vietnamese phone formats', () => {
    expect(normalizeVietnamesePhone('+84 901 234 567')).toBe('0901234567');
    expect(normalizeVietnamesePhone('84901234567')).toBe('0901234567');
    expect(normalizeVietnamesePhone('(090) 123-4567')).toBe('0901234567');
  });

  it('validates Vietnamese phone numbers', () => {
    expect(validatePhone('0901234567')).toBeUndefined();
    expect(validatePhone('+84 901 234 567')).toBeUndefined();
    expect(validatePhone('')).toBe('Vui lòng nhập số điện thoại');
    expect(validatePhone('12345')).toBe('Số điện thoại không hợp lệ');
  });

  it('validates password length in UTF-8 bytes', () => {
    expect(validatePassword('12345678')).toBeUndefined();
    expect(validatePassword('1234567')).toBe('Mật khẩu phải có ít nhất 8 ký tự');
    expect(validatePassword('mậtkhẩu123')).toBeUndefined();
    expect(validatePassword('ẩ'.repeat(40))).toBe('Mật khẩu không được vượt quá 72 byte');
  });

  it('validates optional email addresses', () => {
    expect(validateEmail('')).toBeUndefined();
    expect(validateEmail('an@example.com')).toBeUndefined();
    expect(validateEmail('not-an-email')).toBe('Email không hợp lệ');
  });

  it('validates login forms', () => {
    const errors = validateLogin({ so_dien_thoai: '0901234567', mat_khau: '' });

    expect(errors.so_dien_thoai).toBeUndefined();
    expect(errors.mat_khau).toBe('Vui lòng nhập mật khẩu');
    expect(hasFieldErrors(errors)).toBe(true);
  });

  it('validates registration forms and password confirmation', () => {
    const errors = validateRegister({
      ho_va_ten: 'Nguyễn Văn An',
      so_dien_thoai: '0901234567',
      email: 'an@example.com',
      mat_khau: '12345678',
      xac_nhan_mat_khau: '87654321',
    });

    expect(errors.xac_nhan_mat_khau).toBe('Xác nhận mật khẩu không khớp');
    expect(hasFieldErrors(errors)).toBe(true);
  });
});
