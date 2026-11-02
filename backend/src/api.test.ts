import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { app as gatewayApp } from './app.js';
import { app as eventApp } from './eventService/app.js';

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
});
