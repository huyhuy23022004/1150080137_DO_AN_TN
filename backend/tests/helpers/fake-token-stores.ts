import type { LoginAttemptTracker } from '../../src/modules/auth/login-attempt.tracker';
import type {
  RefreshConsumeResult,
  RefreshTokenStore,
} from '../../src/modules/auth/refresh-token.store';

interface ActiveToken {
  tokenHash: string;
}

export class FakeRefreshTokenStore implements RefreshTokenStore {
  private readonly active = new Map<string, ActiveToken>();
  private readonly known = new Map<string, Set<string>>();

  public async save(
    userId: string,
    jti: string,
    tokenHash: string,
    _ttlSeconds: number,
  ): Promise<void> {
    this.active.set(this.key(userId, jti), { tokenHash });

    const knownForUser = this.known.get(userId) ?? new Set<string>();
    knownForUser.add(jti);
    this.known.set(userId, knownForUser);
  }

  public async consume(
    userId: string,
    jti: string,
    tokenHash: string,
  ): Promise<RefreshConsumeResult> {
    const key = this.key(userId, jti);
    const active = this.active.get(key);

    if (active) {
      if (active.tokenHash !== tokenHash) {
        return 'REUSED';
      }

      this.active.delete(key);
      return 'OK';
    }

    if (this.known.get(userId)?.has(jti)) {
      return 'REUSED';
    }

    return 'MISSING';
  }

  public async revoke(userId: string, jti: string): Promise<void> {
    this.active.delete(this.key(userId, jti));
    this.known.get(userId)?.delete(jti);
  }

  public async revokeAll(userId: string): Promise<void> {
    const prefix = `${userId}:`;

    for (const key of [...this.active.keys()]) {
      if (key.startsWith(prefix)) {
        this.active.delete(key);
      }
    }

    this.known.delete(userId);
  }

  public activeCount(userId: string): number {
    const prefix = `${userId}:`;
    return [...this.active.keys()].filter((key) => key.startsWith(prefix)).length;
  }

  private key(userId: string, jti: string): string {
    return `${userId}:${jti}`;
  }
}

export class FakeLoginAttemptTracker implements LoginAttemptTracker {
  private readonly attempts = new Map<string, number>();

  public constructor(private readonly maxAttempts = 5) {}

  public async isLocked(phone: string): Promise<boolean> {
    return (this.attempts.get(phone) ?? 0) >= this.maxAttempts;
  }

  public async recordFailure(phone: string): Promise<number> {
    const nextCount = (this.attempts.get(phone) ?? 0) + 1;
    this.attempts.set(phone, nextCount);
    return nextCount;
  }

  public async reset(phone: string): Promise<void> {
    this.attempts.delete(phone);
  }
}
