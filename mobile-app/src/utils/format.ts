import { toVietnamDate } from './datetime';

const VND_FORMATTER = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const EMPTY_VALUE = '--';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return EMPTY_VALUE;
  }

  return `${VND_FORMATTER.format(amount)} đ`;
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }

  const date = toVietnamDate(value);
  if (date === null) {
    return EMPTY_VALUE;
  }

  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} ${pad(
    date.getUTCDate(),
  )}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

export function formatTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }

  const date = toVietnamDate(value);
  if (date === null) {
    return EMPTY_VALUE;
  }

  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }

  const date = toVietnamDate(value);
  if (date === null) {
    return EMPTY_VALUE;
  }

  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

export function formatDateChip(value: string | number | Date): string {
  const date = toVietnamDate(value);
  if (date === null) {
    return EMPTY_VALUE;
  }

  const weekday = WEEKDAYS[date.getUTCDay()] ?? '';
  return `${weekday} ${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return EMPTY_VALUE;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);

  if (hours === 0) {
    return `${remaining} phút`;
  }

  if (remaining === 0) {
    return `${hours} giờ`;
  }

  return `${hours} giờ ${remaining} phút`;
}

export function formatDurationBetween(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const minutes = (endDate.getTime() - startDate.getTime()) / 60_000;
  return formatDuration(Number.isFinite(minutes) && minutes > 0 ? minutes : null);
}

export function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}
