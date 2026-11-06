import { extractRefreshCookie } from '../../src/api/client';

describe('refresh cookie parsing', () => {
  it('extracts the refresh cookie from an array header', () => {
    const headers = {
      'set-cookie': [
        'theme=light; Path=/',
        'futa_refresh_token=abc123; Path=/api/v1/auth; HttpOnly; SameSite=Lax',
      ],
    };

    expect(extractRefreshCookie(headers)).toBe('futa_refresh_token=abc123');
  });

  it('extracts the refresh cookie from a combined string header', () => {
    const headers = {
      'Set-Cookie': 'theme=light; Path=/, futa_refresh_token=xyz789; Path=/api/v1/auth; HttpOnly',
    };

    expect(extractRefreshCookie(headers)).toBe('futa_refresh_token=xyz789');
  });

  it('returns null when the refresh cookie is absent', () => {
    expect(extractRefreshCookie({ 'set-cookie': ['theme=light; Path=/'] })).toBeNull();
    expect(extractRefreshCookie(undefined)).toBeNull();
  });
});
