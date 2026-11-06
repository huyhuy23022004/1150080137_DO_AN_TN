import { describe, expect, it } from 'vitest';
import { isValidVietnamesePhone, maskPhone, normalizeVietnamesePhone } from '../../src/utils/phone';

describe('phone utils', () => {
  it('normalizes common Vietnamese phone formats', () => {
    expect(normalizeVietnamesePhone('+84 90 123 4567')).toBe('0901234567');
    expect(normalizeVietnamesePhone('84901234567')).toBe('0901234567');
    expect(normalizeVietnamesePhone('090.123.4567')).toBe('0901234567');
    expect(normalizeVietnamesePhone(' 090-123-4567 ')).toBe('0901234567');
  });

  it('validates Vietnamese phone numbers', () => {
    expect(isValidVietnamesePhone('0901234567')).toBe(true);
    expect(isValidVietnamesePhone('+84901234567')).toBe(true);
    expect(isValidVietnamesePhone('090123456')).toBe(false);
    expect(isValidVietnamesePhone('1900123456')).toBe(false);
    expect(isValidVietnamesePhone('abc')).toBe(false);
  });

  it('masks phone numbers for public responses', () => {
    expect(maskPhone('0901234567')).toBe('090****567');
  });
});
