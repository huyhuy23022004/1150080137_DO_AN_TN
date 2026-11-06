export function normalizeVietnamesePhone(input: string): string {
  let value = input.trim().replace(/[\s.\-()]/g, '');

  if (value.startsWith('+84')) {
    value = `0${value.slice(3)}`;
  } else if (value.startsWith('84') && value.length === 11) {
    value = `0${value.slice(2)}`;
  }

  return value;
}

export function isValidVietnamesePhone(input: string): boolean {
  return /^0\d{9}$/.test(normalizeVietnamesePhone(input));
}

export function maskPhone(input: string): string {
  const value = normalizeVietnamesePhone(input);
  if (value.length < 7) {
    return value;
  }

  return `${value.slice(0, 3)}****${value.slice(-3)}`;
}
