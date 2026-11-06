import { AuthService } from '../../src/modules/auth/auth.service';
import { TokenService, type TokenSettings } from '../../src/modules/auth/token.service';
import { PasswordService } from '../../src/utils/password';
import { FakeAuthRepository } from './fake-auth-repository';
import { FakeLoginAttemptTracker, FakeRefreshTokenStore } from './fake-token-stores';

export const TEST_TOKEN_SETTINGS: TokenSettings = {
  accessSecret: 'test_access_secret_at_least_32_characters_long',
  refreshSecret: 'test_refresh_secret_at_least_32_characters_long',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604_800,
  issuer: 'futa-bus-system',
  audience: 'futa-client',
};

export interface TestAuthContext {
  repository: FakeAuthRepository;
  refreshTokenStore: FakeRefreshTokenStore;
  loginAttemptTracker: FakeLoginAttemptTracker;
  tokenService: TokenService;
  passwordService: PasswordService;
  authService: AuthService;
}

export function buildTestAuth(): TestAuthContext {
  const repository = new FakeAuthRepository();
  const refreshTokenStore = new FakeRefreshTokenStore();
  const loginAttemptTracker = new FakeLoginAttemptTracker(5);
  const tokenService = new TokenService(TEST_TOKEN_SETTINGS);
  const passwordService = new PasswordService(4);

  const authService = new AuthService({
    repository,
    refreshTokenStore,
    loginAttemptTracker,
    tokenService,
    passwordService,
    refreshTtlSeconds: TEST_TOKEN_SETTINGS.refreshTtlSeconds,
  });

  return {
    repository,
    refreshTokenStore,
    loginAttemptTracker,
    tokenService,
    passwordService,
    authService,
  };
}
