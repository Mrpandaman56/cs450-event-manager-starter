import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4001);
const eventServiceUrl = process.env.EVENT_SERVICE_URL || 'http://localhost:4002';

app.use(cors());
app.use(express.json());

const sampleRSVPs = [
  { id: 'rsvp-1', eventId: 'evt-1', guestName: 'Ada', status: 'attending' },
  { id: 'rsvp-2', eventId: 'evt-1', guestName: 'Grace', status: 'waitlist' },
  { id: 'rsvp-3', eventId: 'evt-2', guestName: 'Linus', status: 'attending' }
];

async function forwardToEventService(
  method: 'GET' | 'POST',
  res: express.Response,
  body?: unknown
) {
  try {
    const response = await fetch(`${eventServiceUrl}/events`, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(body) : undefined
    });

    res.status(response.status).json(await response.json());
  } catch (error) {
    console.error('Event service request failed:', error);
    res.status(503).json({ error: 'Event service is unavailable' });
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'event-manager-api-gateway' });
});

app.get('/api/events', (_req, res) => {
  void forwardToEventService('GET', res);
});

app.post('/api/events', (req, res) => {
  void forwardToEventService('POST', res, req.body);
});

app.get('/api/rsvps', (_req, res) => {
  res.json(sampleRSVPs);
});

app.post('/api/rsvps', (req, res) => {
  const { eventId, guestName, status = 'attending' } = req.body ?? {};
  const newRSVP = {
    id: `rsvp-${Date.now()}`,
    eventId,
    guestName: guestName || 'Guest',
    status
  };

  sampleRSVPs.push(newRSVP);
  res.status(201).json(newRSVP);
});

app.listen(port, () => {
  console.log(`Event Manager API gateway running on http://localhost:${port}`);
});
