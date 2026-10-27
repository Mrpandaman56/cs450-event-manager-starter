import test from 'node:test';
import assert from 'node:assert/strict';
import { eventSchema, eventUpdateSchema, invitationSchema } from './eventSchema.js';
import { loginSchema, registerSchema } from './authSchemas.js';

test('event schema validates event data and converts dollar prices to cents', () => {
  const result = eventSchema.parse({
    title: '  Open studio  ',
    date: '2026-12-01',
    location: 'Main hall',
    guidanceUrl: 'https://maps.example.test/event',
    capacity: 24,
    price: 8.5,
    description: 'An evening together',
    inviteEmails: ['FRIEND@example.test']
  });

  assert.equal(result.title, 'Open studio');
  assert.equal(result.price, 850);
  assert.deepEqual(result.inviteEmails, ['friend@example.test']);
});

test('event schema rejects invalid dates, prices, and non-web directions links', () => {
  for (const invalid of [
    { date: '2026-02-30' },
    { price: -1 },
    { guidanceUrl: 'javascript:alert(1)' }
  ]) {
    assert.equal(eventSchema.safeParse({
      title: 'Community dinner',
      date: '2026-12-01',
      location: 'Main hall',
      capacity: 24,
      price: 0,
      ...invalid
    }).success, false);
  }
});

test('event update schema accepts partial changes but rejects empty updates', () => {
  assert.equal(eventUpdateSchema.parse({ capacity: 30 }).capacity, 30);
  assert.equal(eventUpdateSchema.safeParse({}).success, false);
});

test('invitation addresses are normalized and limited to valid emails', () => {
  assert.deepEqual(invitationSchema.parse({ emails: ['  USER@example.test '] }), {
    emails: ['user@example.test']
  });
  assert.equal(invitationSchema.safeParse({ emails: ['not-an-email'] }).success, false);
});

test('account schemas normalize email and require a strong-enough password', () => {
  assert.equal(registerSchema.parse({
    name: 'Guest',
    email: 'GUEST@example.test',
    password: 'long-enough-password'
  }).email, 'guest@example.test');
  assert.equal(registerSchema.safeParse({
    name: 'Guest',
    email: 'guest@example.test',
    password: 'short'
  }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'invalid', password: 'secret' }).success, false);
});
