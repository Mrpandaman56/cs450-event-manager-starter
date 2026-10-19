
import test from 'node:test';
import assert from 'node:assert/strict';
import { raydenEventSchema } from './raydenEventSchema.js';

test('accepts a valid event', () => {
  const result = raydenEventSchema.safeParse({
    title: 'Community Meetup',
    date: '2026-12-01',
    location: 'Main Hall',
    capacity: 50,
    price: 10,
    description: 'A community event'
  });

  assert.equal(result.success, true);
});

test('rejects an event with an empty title', () => {
  const result = raydenEventSchema.safeParse({
    title: '',
    date: '2026-12-01',
    location: 'Main Hall',
    capacity: 50,
    price: 10
  });

  assert.equal(result.success, false);
});

test('rejects an invalid date', () => {
  const result = raydenEventSchema.safeParse({
    title: 'Community Meetup',
    date: '2026-02-30',
    location: 'Main Hall',
    capacity: 50,
    price: 10
  });

  assert.equal(result.success, false);
});

test('rejects zero capacity and a negative price', () => {
  const result = raydenEventSchema.safeParse({
    title: 'Community Meetup',
    date: '2026-12-01',
    location: 'Main Hall',
    capacity: 0,
    price: -5
  });

  assert.equal(result.success, false);
});
