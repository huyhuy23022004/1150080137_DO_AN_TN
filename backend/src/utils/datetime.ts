const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DB_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const TIMEZONE_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;
const VIETNAM_OFFSET = '+07:00';

export function toIsoUtc(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const text = value.trim();
  if (!text) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(text)) {
    return `${text}T00:00:00.000Z`;
  }

  if (DB_DATETIME_PATTERN.test(text)) {
    return new Date(`${text.replace(' ', 'T')}Z`).toISOString();
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return date.toISOString();
}

export function toDatabaseDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }

  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function hasTimezoneOffset(value: string): boolean {
  return TIMEZONE_PATTERN.test(value.trim());
}

export function vietnamDateToUtcStart(date: string): string {
  return toDatabaseDateTime(`${date}T00:00:00${VIETNAM_OFFSET}`);
}

export function vietnamDayRange(date: string): { start: string; end: string } {
  const start = new Date(`${date}T00:00:00${VIETNAM_OFFSET}`);

  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid date value: ${date}`);
  }

  const end = new Date(start.getTime() + 86_400_000);
  return {
    start: toDatabaseDateTime(start),
    end: toDatabaseDateTime(end),
  };
}

export function addMinutesToUtc(value: string | Date, minutes: number): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }

  return toDatabaseDateTime(new Date(date.getTime() + minutes * 60_000));
}

export function nowDatabaseDateTime(): string {
  return toDatabaseDateTime(new Date());
}
