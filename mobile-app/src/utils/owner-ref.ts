const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function createOwnerRef(): string {
  let randomPart = '';

  for (let index = 0; index < 18; index += 1) {
    randomPart += ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? 'x';
  }

  return `m${Date.now().toString(36)}_${randomPart}`.slice(0, 50);
}

export function isValidOwnerRef(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,50}$/.test(value);
}
