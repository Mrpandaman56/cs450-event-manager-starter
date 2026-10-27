
import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { app as userApp } from './userService/app.js';
import { app as eventApp } from './eventService/app.js';

describe('POST /auth/login (user service)', () => {
  test('rejects invalid login input with 400', async () => {
    const response = await request(userApp)
      .post('/auth/login')
      .send({ email: 'invalid', password: 'x' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request body');
  });
});

describe('GET /events (event service)', () => {
  test('rejects a request with no session cookie', async () => {
    const response = await request(eventApp).get('/events');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Sign in to continue');
  });
});

describe('POST /auth/register (user service)', () => {
  test('rejects a short password with 400', async () => {
    const response = await request(userApp)
      .post('/auth/register')
      .send({
        name: 'Guest',
        email: 'guest@example.test',
        password: 'short'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request body');
  });
});
