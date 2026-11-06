const DURATION_UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3_600,
  d: 86_400,
  w: 604_800,
};

export function parseDurationToSeconds(value: string): number {
  const normalized = value.trim().toLowerCase();
  const match = /^(\d+)\s*(s|m|h|d|w)?$/.exec(normalized);

  if (!match) {
    throw new Error(`Invalid duration: "${value}"`);
  }

  const amountText = match[1];
  if (amountText === undefined) {
    throw new Error(`Invalid duration: "${value}"`);
  }

  const amount = Number(amountText);
  const unit = match[2] ?? 's';
  const multiplier = DURATION_UNITS[unit];

  if (!Number.isFinite(amount) || amount <= 0 || multiplier === undefined) {
    throw new Error(`Invalid duration: "${value}"`);
  }

  return amount * multiplier;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
