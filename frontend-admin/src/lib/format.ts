import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const VN_UTC_OFFSET = 7;
const EMPTY_VALUE = '—';

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return EMPTY_VALUE;
  }

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace('.', ',')} tỷ`;
  }

  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace('.', ',')} tr`;
  }

  if (absolute >= 1_000) {
    return `${Math.round(value / 1_000)} k`;
  }

  return String(value);
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  format = 'DD/MM/YYYY HH:mm',
): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }

  const date = dayjs(value);

  if (!date.isValid()) {
    return EMPTY_VALUE;
  }

  return date.utcOffset(VN_UTC_OFFSET).format(format);
}

export function formatDate(value: string | number | Date | null | undefined): string {
  return formatDateTime(value, 'DD/MM/YYYY');
}

export function formatTime(value: string | number | Date | null | undefined): string {
  return formatDateTime(value, 'HH:mm');
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY_VALUE;
  }

  return new Intl.NumberFormat('vi-VN').format(value);
}

export function formatDistance(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return EMPTY_VALUE;
  }

  return `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} km`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return EMPTY_VALUE;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours === 0) {
    return `${remaining} phút`;
  }

  if (remaining === 0) {
    return `${hours} giờ`;
  }

  return `${hours} giờ ${remaining} phút`;
}
