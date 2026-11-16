import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import express from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { createAuthToken, requireAuth, validateJwtConfiguration } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { loginSchema, registerSchema } from '../schemas/authSchemas.js';

const app = express();
const port = Number(process.env.USER_SERVICE_PORT || 4003);
const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);

app.use(express.json());

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

const dummyPasswordHash = hashPassword(randomBytes(32).toString('hex'));

async function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== 64 || expected.toString('hex') !== expectedHex) {
    return false;
  }
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

app.get('/health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: 'ok', service: 'user-service', database: 'connected' });
  } catch (error) {
    console.error('User service health check failed:', error);
    response.status(503).json({ status: 'unavailable', service: 'user-service', database: 'disconnected' });
  }
});

app.post('/auth/register', validateBody(registerSchema), async (request, response) => {
  const input = registerSchema.parse(request.body);
  try {
    validateJwtConfiguration();
    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash
      },
      select: { id: true, name: true, email: true, createdAt: true }
    });

    response.status(201).json({ user, ...createAuthToken(user.id) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      response.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    console.error('Could not create user account:', error);
    response.status(503).json({ error: 'Could not create your account right now' });
  }
});

app.post('/auth/login', validateBody(loginSchema), async (request, response) => {
  const input = loginSchema.parse(request.body);
  try {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const storedHash = user?.passwordHash ?? await dummyPasswordHash;
    const passwordMatches = await verifyPassword(input.password, storedHash);
    if (!user || !passwordMatches) {
      response.status(401).json({ error: 'Email or password is incorrect' });
      return;
    }

    response.json({
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      ...createAuthToken(user.id)
    });
  } catch (error) {
    console.error('Could not sign in user:', error);
    response.status(503).json({ error: 'Could not sign in right now' });
  }
});

app.get('/auth/me', requireAuth, async (request, response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true, name: true, email: true, createdAt: true }
    });
    if (!user) {
      response.status(401).json({ error: 'Your account is no longer available' });
      return;
    }
    response.json({ user });
  } catch (error) {
    console.error('Could not load current user:', error);
    response.status(503).json({ error: 'Could not load your account right now' });
  }
});

export { app, port };
