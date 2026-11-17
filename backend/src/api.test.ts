import { afterEach, describe, expect, test, vi } from 'vitest';
import request from 'supertest';
import { app as gatewayApp } from './app.js';
import { app as eventApp } from './eventService/app.js';
import { app as userApp } from './userService/app.js';

describe('API gateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('GET /api/health reports that the gateway is running', async () => {
    const response = await request(gatewayApp).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', app: 'event-manager-api-gateway' });
  });

  test('forwards bearer credentials and preserves service authentication responses', async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => new Response(
      JSON.stringify({ error: 'Sign in to continue' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(gatewayApp)
      .get('/api/events')
      .set('Authorization', 'Bearer invalid-token');

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/events', 'http://localhost:4002'),
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' }
      })
    );
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Sign in to continue' });
  });

  test('keeps public registration requests available without a token', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ user: { id: 'user-1' }, token: 'signed-token' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(gatewayApp)
      .post('/api/auth/register')
      .send({ name: 'Guest', email: 'guest@example.test', password: 'long-enough-password' });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/auth/register', 'http://localhost:4003'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token', 'signed-token');
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
