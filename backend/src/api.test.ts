import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { app as gatewayApp } from './app.js';
import { app as eventApp } from './eventService/app.js';
import { app as userApp } from './userService/app.js';

describe('API gateway', () => {
  test('GET /api/health reports that the gateway is running', async () => {
    const response = await request(gatewayApp).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', app: 'event-manager-api-gateway' });
  });
});

describe('Event service', () => {
  test('GET /events requires a signed-in user', async () => {
    const response = await request(eventApp).get('/events');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Sign in to continue' });
  });

  test('legacy session cookies do not authenticate requests', async () => {
    const response = await request(eventApp)
      .get('/events')
      .set('Cookie', 'event_session=legacy-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Sign in to continue' });
  });

  test('invalid bearer tokens receive a generic unauthorized response', async () => {
    const response = await request(eventApp)
      .get('/events')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Sign in to continue' });
  });
});

describe('Authentication input validation', () => {
  test('invalid registration input is rejected before creating an account', async () => {
    const response = await request(userApp)
      .post('/auth/register')
      .send({ name: 'Guest', email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request body');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  test('invalid login input is rejected before creating a token', async () => {
    const response = await request(userApp)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request body');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
