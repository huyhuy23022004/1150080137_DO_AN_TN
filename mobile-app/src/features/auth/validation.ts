export interface FieldErrors {
  [field: string]: string | undefined;
}

export function normalizeVietnamesePhone(input: string): string {
  let value = input.trim().replace(/[\s.\-()]/g, '');

  if (value.startsWith('+84')) {
    value = `0${value.slice(3)}`;
  } else if (value.startsWith('84') && value.length === 11) {
    value = `0${value.slice(2)}`;
  }

  return value;
}

export function validatePhone(value: string): string | undefined {
  if (!value.trim()) {
    return 'Vui lòng nhập số điện thoại';
  }

  if (!/^0\d{9}$/.test(normalizeVietnamesePhone(value))) {
    return 'Số điện thoại không hợp lệ';
  }

  return undefined;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;

    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }

  return bytes;
}

export function validatePassword(value: string): string | undefined {
  if (!value) {
    return 'Vui lòng nhập mật khẩu';
  }

  if (value.length < 8) {
    return 'Mật khẩu phải có ít nhất 8 ký tự';
  }

  if (utf8ByteLength(value) > 72) {
    return 'Mật khẩu không được vượt quá 72 byte';
  }

  return undefined;
}

export function validateFullName(value: string): string | undefined {
  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return 'Họ và tên phải có ít nhất 2 ký tự';
  }

  if (trimmed.length > 100) {
    return 'Họ và tên không được vượt quá 100 ký tự';
  }

  return undefined;
}

export function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Email không hợp lệ';
  }

  return undefined;
}

export function validateLogin(input: { so_dien_thoai: string; mat_khau: string }): FieldErrors {
  return {
    so_dien_thoai: validatePhone(input.so_dien_thoai),
    mat_khau: input.mat_khau ? undefined : 'Vui lòng nhập mật khẩu',
  };
}

export function validateRegister(input: {
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string;
  mat_khau: string;
  xac_nhan_mat_khau: string;
}): FieldErrors {
  return {
    ho_va_ten: validateFullName(input.ho_va_ten),
    so_dien_thoai: validatePhone(input.so_dien_thoai),
    email: validateEmail(input.email),
    mat_khau: validatePassword(input.mat_khau),
    xac_nhan_mat_khau:
      input.mat_khau === input.xac_nhan_mat_khau ? undefined : 'Xác nhận mật khẩu không khớp',
  };
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
