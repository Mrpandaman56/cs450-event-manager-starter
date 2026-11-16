import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

export const jwtIssuer = 'event-manager-user-service';
export const jwtAudience = 'event-manager-api';
export const jwtTokenLifetimeSeconds = 60 * 60;

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

export function validateJwtConfiguration() {
  getJwtSecret();
}

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createAuthToken(userId: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + jwtTokenLifetimeSeconds;
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: userId,
    iss: jwtIssuer,
    aud: jwtAudience,
    iat: issuedAt,
    exp: expiresAt
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac('sha256', getJwtSecret()).update(unsignedToken).digest('base64url');

  return {
    token: `${unsignedToken}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString()
  };
}

export function verifyAuthToken(token: string, now = Math.floor(Date.now() / 1000)) {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac('sha256', getJwtSecret()).update(unsignedToken).digest();
  const actualSignature = Buffer.from(encodedSignature, 'base64url');
  if (actualSignature.toString('base64url') !== encodedSignature
    || actualSignature.length !== expectedSignature.length
    || !timingSafeEqual(actualSignature, expectedSignature)) {
    return null;
  }

  try {
    const header: unknown = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const payload: unknown = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (typeof header !== 'object' || header === null || !('alg' in header) || header.alg !== 'HS256'
      || typeof payload !== 'object' || payload === null
      || !('sub' in payload) || typeof payload.sub !== 'string' || !payload.sub
      || !('iss' in payload) || payload.iss !== jwtIssuer
      || !('aud' in payload) || payload.aud !== jwtAudience
      || !('iat' in payload) || typeof payload.iat !== 'number' || !Number.isInteger(payload.iat)
      || !('exp' in payload) || typeof payload.exp !== 'number' || !Number.isInteger(payload.exp)
      || payload.exp <= now || payload.iat > now) {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

export const requireAuth: RequestHandler = (request, response, next) => {
  try {
    const authorization = request.get('authorization');
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    const userId = match ? verifyAuthToken(match[1]) : null;
    if (!userId) {
      response.status(401).json({ error: 'Sign in to continue' });
      return;
    }

    request.userId = userId;
    next();
  } catch (error) {
    console.error('Could not verify the access token:', error);
    response.status(503).json({ error: 'Authentication service is unavailable' });
  }
};
