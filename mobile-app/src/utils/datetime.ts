const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

function toDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toVietnamDate(value: string | number | Date): Date | null {
  const date = toDate(value);
  return date === null ? null : new Date(date.getTime() + VIETNAM_OFFSET_MS);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toVietnamDateString(value: string | number | Date = new Date()): string {
  const date = toVietnamDate(value);
  if (date === null) {
    return '';
  }

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(value: string | number | Date, days: number): Date {
  const date = toDate(value) ?? new Date();
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function startOfVietnamDay(value: string | number | Date): Date {
  const date = toVietnamDate(value);
  if (date === null) {
    return new Date();
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - VIETNAM_OFFSET_MS,
  );
}

export function nextDays(count: number, from: Date = new Date()): string[] {
  const start = startOfVietnamDay(from);
  return Array.from({ length: count }, (_, index) => toVietnamDateString(addDays(start, index)));
}
