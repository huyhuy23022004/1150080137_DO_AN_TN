import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/common/errors/AppError';
import { PasswordService } from '../../src/utils/password';

describe('PasswordService', () => {
  const service = new PasswordService(4);

  it('hashes and verifies a password', async () => {
    const hash = await service.hash('MatKhau@123');
    expect(hash).not.toBe('MatKhau@123');
    await expect(service.verify('MatKhau@123', hash)).resolves.toBe(true);
    await expect(service.verify('WrongPassword', hash)).resolves.toBe(false);
  });

  it('rejects passwords longer than 72 bytes', async () => {
    const password = 'a'.repeat(73);

    await expect(service.hash(password)).rejects.toBeInstanceOf(AppError);
  });

  it('returns a verifiable dummy hash', async () => {
    const dummyHash = await service.getDummyHash();
    await expect(service.verify('anything', dummyHash)).resolves.toBe(false);
  });
});
