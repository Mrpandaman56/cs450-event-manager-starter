import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { jwtAudience, jwtIssuer, jwtTokenLifetimeSeconds, verifyAuthToken } from '../middleware/auth.js';

const { users, userCreate, userFindUnique, UniqueConstraintError } = vi.hoisted(() => {
  type StoredUser = {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
  };

  const users = new Map<string, StoredUser>();
  const userCreate = vi.fn();
  const userFindUnique = vi.fn();

  class UniqueConstraintError extends Error {
    code = 'P2002';
  }

  return { users, userCreate, userFindUnique, UniqueConstraintError };
});

vi.mock('@prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: UniqueConstraintError },
  PrismaClient: class {
    user = { create: userCreate, findUnique: userFindUnique };
    $queryRaw = vi.fn();
  }
}));

const originalJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';

afterAll(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

beforeEach(() => {
  users.clear();
  userCreate.mockReset();
  userFindUnique.mockReset();
  userCreate.mockImplementation(async ({ data }: {
    data: { name: string; email: string; passwordHash: string };
  }) => {
    if (users.has(data.email)) {
      throw new UniqueConstraintError();
    }

    const user = {
      id: `user-${users.size + 1}`,
      ...data,
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    };
    users.set(user.email, user);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  });
  userFindUnique.mockImplementation(async ({ where, select }: {
    where: { email?: string; id?: string };
    select?: Record<string, boolean>;
  }) => {
    const user = [...users.values()].find((candidate) => (
      where.email ? candidate.email === where.email : candidate.id === where.id
    ));
    if (!user || !select) {
      return user ?? null;
    }
    return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
  });
});

describe('registration and login', () => {
  test('rejects malformed registration and login input without creating a user or token', async () => {
    const invalidRegistration = await request(app)
      .post('/auth/register')
      .send({ name: 'Guest', email: 'not-an-email', password: 'short' });
    const invalidLogin = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(invalidRegistration.status).toBe(400);
    expect(invalidRegistration.body).not.toHaveProperty('token');
    expect(invalidLogin.status).toBe(400);
    expect(invalidLogin.body).not.toHaveProperty('token');
    expect(userCreate).not.toHaveBeenCalled();
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(users.size).toBe(0);
  });

  test('registers a normalized user with a password hash and returns no credential data', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ name: ' Guest ', email: ' Guest@Example.test ', password: 'long-enough-password' });

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({
      id: 'user-1',
      name: 'Guest',
      email: 'guest@example.test',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('expiresAt');
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(userCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'guest@example.test', name: 'Guest' }),
      select: { id: true, name: true, email: true, createdAt: true }
    }));
    expect(users.get('guest@example.test')?.passwordHash)
      .toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(users.get('guest@example.test')?.passwordHash).not.toContain('long-enough-password');
  });

  test('returns a consistent conflict for duplicate normalized email addresses', async () => {
    const first = await request(app)
      .post('/auth/register')
      .send({ name: 'Guest', email: 'guest@example.test', password: 'long-enough-password' });
    const duplicate = await request(app)
      .post('/auth/register')
      .send({ name: 'Another Guest', email: ' GUEST@EXAMPLE.TEST ', password: 'different-password' });

    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: 'An account with this email already exists' });
    expect(users.size).toBe(1);
  });

  test('logs in with valid credentials and issues the agreed JWT claims', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'Guest', email: 'GUEST@example.test', password: 'long-enough-password' });
    const response = await request(app)
      .post('/auth/login')
      .send({ email: ' guest@example.test ', password: 'long-enough-password' });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: 'user-1',
      name: 'Guest',
      email: 'guest@example.test',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('passwordHash');
    const payload = JSON.parse(Buffer.from(response.body.token.split('.')[1], 'base64url').toString('utf8'));
    expect(Object.keys(payload).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sub']);
    expect(payload).toMatchObject({
      sub: 'user-1',
      iss: jwtIssuer,
      aud: jwtAudience
    });
    expect(payload.exp - payload.iat).toBe(jwtTokenLifetimeSeconds);
    expect(verifyAuthToken(response.body.token)).toBe('user-1');
  });

  test('loads the authenticated user from a bearer token without returning the password hash', async () => {
    const registration = await request(app)
      .post('/auth/register')
      .send({ name: 'Guest', email: 'guest@example.test', password: 'long-enough-password' });
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${registration.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: 'user-1',
      name: 'Guest',
      email: 'guest@example.test',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  test('returns the same generic unauthorized response for unknown users and wrong passwords', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'Guest', email: 'guest@example.test', password: 'long-enough-password' });
    const unknownUser = await request(app)
      .post('/auth/login')
      .send({ email: 'unknown@example.test', password: 'long-enough-password' });
    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ email: 'guest@example.test', password: 'incorrect-password' });

    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.body).toEqual({ error: 'Email or password is incorrect' });
    expect(wrongPassword.body).toEqual(unknownUser.body);
    expect(unknownUser.body).not.toHaveProperty('token');
    expect(wrongPassword.body).not.toHaveProperty('token');
  });
});
