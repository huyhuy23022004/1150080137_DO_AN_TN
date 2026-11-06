import {
  formatCountdown,
  formatCurrency,
  formatDate,
  formatDateChip,
  formatDateTime,
  formatDuration,
  formatDurationBetween,
  formatTime,
} from '../../src/utils/format';
import { nextDays, toVietnamDateString } from '../../src/utils/datetime';

describe('format utilities', () => {
  it('formats VND amounts', () => {
    expect(formatCurrency(150000)).toBe('150.000 đ');
    expect(formatCurrency('250000')).toBe('250.000 đ');
    expect(formatCurrency(null)).toBe('--');
    expect(formatCurrency('invalid')).toBe('--');
  });

  it('formats times in the Vietnam timezone', () => {
    const value = '2026-10-24T02:30:00.000Z';

    expect(formatTime(value)).toBe('09:30');
    expect(formatDate(value)).toBe('24/10/2026');
    expect(formatDateTime(value)).toBe('09:30 24/10/2026');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 phút');
    expect(formatDuration(60)).toBe('1 giờ');
    expect(formatDuration(95)).toBe('1 giờ 35 phút');
    expect(formatDurationBetween('2026-10-24T01:00:00Z', '2026-10-24T03:30:00Z')).toBe(
      '2 giờ 30 phút',
    );
  });

  it('formats countdowns without going below zero', () => {
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(-5)).toBe('00:00');
  });

  it('formats compact date chips', () => {
    expect(formatDateChip('2026-10-24')).toBe('T7 24/10');
  });

  it('builds the next seven Vietnam dates', () => {
    const days = nextDays(7, new Date('2026-10-24T02:00:00Z'));

    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-10-24');
    expect(days[6]).toBe('2026-10-30');
  });

  it('converts instants to Vietnam date keys', () => {
    expect(toVietnamDateString('2026-10-24T18:30:00Z')).toBe('2026-10-25');
    expect(toVietnamDateString('invalid')).toBe('');
  });
});
