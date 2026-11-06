const MONEY_PATTERN = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/;

export function normalizeMoney(value: string | number): string {
  const text = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const match = MONEY_PATTERN.exec(text);

  if (!match) {
    throw new Error(`Invalid money value: ${String(value)}`);
  }

  const integerPart = match[1];
  if (integerPart === undefined) {
    throw new Error(`Invalid money value: ${String(value)}`);
  }

  const fraction = (match[2] ?? '').padEnd(2, '0');
  return `${integerPart}.${fraction}`;
}

export function isPositiveMoney(value: string | number): boolean {
  try {
    return normalizeMoney(value) !== '0.00';
  } catch {
    return false;
  }
}
