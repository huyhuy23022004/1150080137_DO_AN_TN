import { describe, expect, it } from 'vitest';
import { parseDurationToSeconds } from '../../src/utils/time';

describe('parseDurationToSeconds', () => {
  it('parses supported units', () => {
    expect(parseDurationToSeconds('30s')).toBe(30);
    expect(parseDurationToSeconds('15m')).toBe(900);
    expect(parseDurationToSeconds('2h')).toBe(7_200);
    expect(parseDurationToSeconds('7d')).toBe(604_800);
    expect(parseDurationToSeconds('1w')).toBe(604_800);
    expect(parseDurationToSeconds('45')).toBe(45);
  });

  it('rejects invalid values', () => {
    expect(() => parseDurationToSeconds('')).toThrow();
    expect(() => parseDurationToSeconds('abc')).toThrow();
    expect(() => parseDurationToSeconds('0m')).toThrow();
    expect(() => parseDurationToSeconds('-5m')).toThrow();
  });
});
