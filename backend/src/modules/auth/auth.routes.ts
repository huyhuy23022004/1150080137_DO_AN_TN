import { Router } from 'express';
import { createAuthMiddleware } from '../../middlewares/auth.middleware';
import { authLimiter, loginLimiter, refreshLimiter } from '../../middlewares/rate-limit.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createAuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { TokenService } from './token.service';
import {
  changePasswordValidators,
  loginValidators,
  refreshTokenValidators,
  registerValidators,
  updateProfileValidators,
} from './auth.validator';

export function createAuthRouter(service: AuthService, tokenService: TokenService): Router {
  const router = Router();
  const controller = createAuthController(service);
  const authenticate = createAuthMiddleware(tokenService);

  router.post('/register', authLimiter, ...validate(registerValidators), controller.register);

  router.post('/login', loginLimiter, ...validate(loginValidators), controller.login);

  router.post('/refresh', refreshLimiter, ...validate(refreshTokenValidators), controller.refresh);

  router.post('/logout', ...validate(refreshTokenValidators), controller.logout);

  router.get('/me', authenticate, controller.me);

  router.patch('/me', authenticate, ...validate(updateProfileValidators), controller.updateProfile);

  router.post(
    '/change-password',
    authenticate,
    ...validate(changePasswordValidators),
    controller.changePassword,
  );

  router.post('/logout-all', authenticate, controller.logoutAll);

  return router;
}
