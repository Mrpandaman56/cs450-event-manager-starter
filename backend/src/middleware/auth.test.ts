import { createHmac } from 'node:crypto';
import express from 'express';
import type { Request, Response } from 'express';
import request from 'supertest';
import { afterAll, describe, expect, test, vi } from 'vitest';
import {
  createAuthToken,
  jwtAudience,
  jwtIssuer,
  jwtTokenLifetimeSeconds,
  requireAuth,
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
  const protectedOperation = vi.fn((_request: Request, response: Response) => {
    response.json({ accessed: true });
  });
  const protectedApp = express();
  protectedApp.get('/protected', requireAuth, protectedOperation);

  function signToken(payload: object) {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsignedToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
    const signature = createHmac('sha256', process.env.JWT_SECRET!)
      .update(unsignedToken)
      .digest('base64url');
    return `${unsignedToken}.${signature}`;
  }

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

  test.each([
    ['missing', undefined],
    ['malformed', 'Bearer not-a-jwt'],
    ['invalid signature', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdHRhY2tlciJ9.invalid'],
    ['expired', `Bearer ${signToken({
      sub: 'user-123',
      iss: jwtIssuer,
      aud: jwtAudience,
      iat: 1,
      exp: 2
    })}`]
  ])('rejects %s credentials before the protected operation', async (_name, authorization) => {
    protectedOperation.mockClear();
    let protectedRequest = request(protectedApp).get('/protected');
    if (authorization) {
      protectedRequest = protectedRequest.set('Authorization', authorization);
    }
    const response = await protectedRequest;

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Sign in to continue' });
    expect(protectedOperation).not.toHaveBeenCalled();
  });

  test('derives the authenticated identity from the verified subject', async () => {
    protectedOperation.mockClear();
    const { token } = createAuthToken('user-123');
    const response = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accessed: true });
    expect(protectedOperation).toHaveBeenCalled();
    expect(protectedOperation.mock.calls[0][0].userId).toBe('user-123');
  });
});
