import { afterAll, describe, expect, test } from 'vitest';
import {
  createAuthToken,
  jwtAudience,
  jwtIssuer,
  jwtTokenLifetimeSeconds,
  validateJwtConfiguration,
  verifyAuthToken
} from './auth.js';

const originalJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';

afterAll(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

describe('JWT authentication tokens', () => {
  test('requires a sufficiently long signing secret from environment configuration', () => {
    const secret = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      expect(validateJwtConfiguration).toThrow('JWT_SECRET');
      process.env.JWT_SECRET = 'too-short';
      expect(validateJwtConfiguration).toThrow('JWT_SECRET');
    } finally {
      process.env.JWT_SECRET = secret;
    }
  });

  test('signs the account identity with a one-hour expiry', () => {
    const { token, expiresAt } = createAuthToken('user-123');
    const [headerPart, payloadPart] = token.split('.');
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));

    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(Object.keys(payload).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sub']);
    expect(payload).toMatchObject({ sub: 'user-123', iss: jwtIssuer, aud: jwtAudience });
    expect(payload.exp - payload.iat).toBe(jwtTokenLifetimeSeconds);
    expect(expiresAt).toBe(new Date(payload.exp * 1000).toISOString());
    expect(verifyAuthToken(token)).toBe('user-123');
  });

  test('rejects tampered and expired tokens', () => {
    const { token } = createAuthToken('user-123');
    const [header, payload, signature] = token.split('.');
    const tampered = `${header}.${payload}.${signature.slice(0, -1)}${signature.endsWith('a') ? 'b' : 'a'}`;

    expect(verifyAuthToken(tampered)).toBeNull();
    expect(verifyAuthToken(token, Math.floor(Date.now() / 1000) + 60 * 60)).toBeNull();
    expect(verifyAuthToken('not-a-jwt')).toBeNull();
  });
});
