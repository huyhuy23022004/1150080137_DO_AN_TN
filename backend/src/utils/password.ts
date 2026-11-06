import bcrypt from 'bcrypt';
import { AppError } from '../common/errors/AppError';
import { ERROR_CODES } from '../common/errors/error-codes';
import { HTTP_STATUS } from '../common/http-status';

export const MAX_PASSWORD_BYTES = 72;

export class PasswordService {
  private dummyHashPromise: Promise<string> | null = null;

  public constructor(private readonly saltRounds: number) {}

  public async hash(plainPassword: string): Promise<string> {
    this.assertPasswordLength(plainPassword);
    return bcrypt.hash(plainPassword, this.saltRounds);
  }

  public async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    if (!plainPassword || !passwordHash) {
      return false;
    }

    try {
      return await bcrypt.compare(plainPassword, passwordHash);
    } catch {
      return false;
    }
  }

  public async getDummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = bcrypt.hash('__dummy_password_for_timing__', this.saltRounds);
    }

    return this.dummyHashPromise;
  }

  private assertPasswordLength(plainPassword: string): void {
    if (!plainPassword || Buffer.byteLength(plainPassword, 'utf8') > MAX_PASSWORD_BYTES) {
      throw new AppError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        'Mật khẩu phải có độ dài từ 1 đến 72 byte',
      );
    }
  }
}
