import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import request from 'supertest';
import { createAuthToken } from '../middleware/auth.js';
import { app } from './app.js';

const mocks = vi.hoisted(() => {
  const event = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn()
  };
  const registration = {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  };
  const invitation = {
    findFirst: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  };
  const transaction = {
    event,
    registration,
    invitation
  };
  const user = { findMany: vi.fn() };
  const prisma = {
    event,
    registration,
    invitation,
    user,
    $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction))
  };
  return { event, registration, invitation, transaction, user, prisma };
});

vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code = '';
    },
    TransactionIsolationLevel: { Serializable: 'Serializable' }
  },
  PrismaClient: class {
    event = mocks.event;
    registration = mocks.registration;
    invitation = mocks.invitation;
    user = mocks.user;
    $transaction = mocks.prisma.$transaction;
    $queryRaw = vi.fn();
  }
}));

const originalJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';

afterAll(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

function authHeader(userId: string) {
  return `Bearer ${createAuthToken(userId).token}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.event.findMany.mockResolvedValue([]);
  mocks.event.findUnique.mockResolvedValue({
    id: 'event-1',
    date: new Date('2099-01-01T00:00:00.000Z'),
    inviteOnly: false,
    createdById: 'creator-1',
    capacity: 10,
    remainingSpots: 10
  });
  mocks.event.findUniqueOrThrow.mockResolvedValue({
    id: 'event-1',
    date: new Date('2099-01-01T00:00:00.000Z'),
    priceCents: 0,
    registrations: [],
    _count: { registrations: 0 },
    creator: { id: 'creator-1', name: 'Creator' },
    inviteOnly: false,
    remainingSpots: 10
  });
  mocks.event.updateMany.mockResolvedValue({ count: 1 });
  mocks.event.update.mockResolvedValue({ id: 'event-1' });
  mocks.registration.findUnique.mockResolvedValue(null);
  mocks.registration.count.mockResolvedValue(0);
  mocks.registration.create.mockImplementation(async ({ data }: {
    data: { eventId: string; userId: string; status: string };
  }) => ({ id: 'registration-1', ...data }));
  mocks.invitation.findFirst.mockResolvedValue(null);
  mocks.invitation.createMany.mockResolvedValue({ count: 1 });
  mocks.invitation.updateMany.mockResolvedValue({ count: 0 });
  mocks.invitation.update.mockResolvedValue({});
});

describe('event resource authorization', () => {
  test('only the creator can view event attendance', async () => {
    const eventWithAttendance = {
      id: 'event-1',
      createdById: 'creator-1',
      capacity: 10,
      remainingSpots: 9,
      registrations: [],
      invitations: []
    };
    mocks.event.findUnique.mockResolvedValue(eventWithAttendance);

    const creatorResponse = await request(app)
      .get('/events/event-1/attendance')
      .set('Authorization', authHeader('creator-1'));
    const otherUserResponse = await request(app)
      .get('/events/event-1/attendance')
      .set('Authorization', authHeader('other-user'));

    expect(creatorResponse.status).toBe(200);
    expect(otherUserResponse.status).toBe(403);
    expect(otherUserResponse.body).toEqual({ error: 'Only the event creator can view the guest list' });
  });

  test('only the creator can edit an event', async () => {
    const nonCreator = await request(app)
      .patch('/events/event-1')
      .set('Authorization', authHeader('other-user'))
      .send({ title: 'Updated title' });
    const creator = await request(app)
      .patch('/events/event-1')
      .set('Authorization', authHeader('creator-1'))
      .send({ title: 'Updated title' });

    expect(nonCreator.status).toBe(403);
    expect(creator.status).toBe(200);
  });

  test('only the creator can manage invitations', async () => {
    mocks.user.findMany.mockResolvedValue([{ id: 'recipient-1', email: 'guest@example.test' }]);

    const nonCreator = await request(app)
      .post('/events/event-1/invitations')
      .set('Authorization', authHeader('other-user'))
      .send({ emails: ['guest@example.test'] });
    const creator = await request(app)
      .post('/events/event-1/invitations')
      .set('Authorization', authHeader('creator-1'))
      .send({ emails: ['guest@example.test'] });

    expect(nonCreator.status).toBe(403);
    expect(creator.status).toBe(201);
    expect(mocks.invitation.createMany).toHaveBeenCalledWith({
      data: [{ eventId: 'event-1', senderId: 'creator-1', recipientId: 'recipient-1' }],
      skipDuplicates: true
    });
  });

  test('registration identity comes from the JWT subject, not a supplied userId', async () => {
    const response = await request(app)
      .post('/events/event-1/registrations')
      .set('Authorization', authHeader('authenticated-user'))
      .send({ status: 'attending' });

    expect(response.status).toBe(201);
    expect(mocks.registration.findUnique).toHaveBeenCalledWith({
      where: { eventId_userId: { eventId: 'event-1', userId: 'authenticated-user' } }
    });
    expect(mocks.registration.create).toHaveBeenCalledWith({
      data: { eventId: 'event-1', userId: 'authenticated-user', status: 'attending' }
    });

    const attemptedOverride = await request(app)
      .post('/events/event-1/registrations')
      .set('Authorization', authHeader('authenticated-user'))
      .send({ status: 'attending', userId: 'different-user' });

    expect(attemptedOverride.status).toBe(400);
    expect(mocks.registration.create).toHaveBeenCalledTimes(1);
  });

  test('invitation actions are limited to the intended recipient', async () => {
    mocks.invitation.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const nonRecipient = await request(app)
      .post('/invitations/invitation-1/decline')
      .set('Authorization', authHeader('other-user'));
    const recipient = await request(app)
      .post('/invitations/invitation-1/decline')
      .set('Authorization', authHeader('recipient-1'));

    expect(nonRecipient.status).toBe(404);
    expect(recipient.status).toBe(204);
    expect(mocks.invitation.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'invitation-1', recipientId: 'other-user', status: 'pending' },
      data: { status: 'declined' }
    });
    expect(mocks.invitation.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'invitation-1', recipientId: 'recipient-1', status: 'pending' },
      data: { status: 'declined' }
    });
  });
});
