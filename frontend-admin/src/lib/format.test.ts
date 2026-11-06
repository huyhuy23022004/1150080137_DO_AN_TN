import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatDateTime, formatTime } from './format';

describe('format helpers', () => {
  it('formats money without losing bigint precision', () => {
    expect(formatCurrency('1000000')).toContain('1.000.000');
    expect(formatCurrency(250000)).toContain('250.000');
  });

  it('returns a dash for missing money values', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency('not-a-number')).toBe('—');
  });

  it('converts UTC timestamps to Vietnam time', () => {
    expect(formatDateTime('2026-10-21T01:00:00.000Z')).toBe('21/10/2026 08:00');
    expect(formatDate('2026-10-21T01:00:00.000Z')).toBe('21/10/2026');
    expect(formatTime('2026-10-21T01:00:00.000Z')).toBe('08:00');
  });

  it('returns a dash for invalid dates', () => {
    expect(formatDateTime('invalid')).toBe('—');
    expect(formatDateTime(null)).toBe('—');
  });
});
