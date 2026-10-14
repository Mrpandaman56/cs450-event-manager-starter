import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { eventSchema } from '../schemas/eventSchema.js';
import { validateBody } from '../middleware/validateBody.js';

dotenv.config();

const app = express();
const port = Number(process.env.EVENT_SERVICE_PORT || 4002);
const prisma = new PrismaClient();

app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'event-service', database: 'connected' });
  } catch (error) {
    console.error('Event database health check failed:', error);
    res.status(503).json({ status: 'unavailable', service: 'event-service', database: 'disconnected' });
  }
});

app.get('/events', async (_req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: [{ date: 'asc' }, { createdAt: 'desc' }]
    });

    res.json(events.map(({ date, ...event }) => ({
      ...event,
      date: date.toISOString().slice(0, 10)
    })));
  } catch (error) {
    console.error('Could not load events from the event database:', error);
    res.status(503).json({ error: 'Event database is unavailable' });
  }
});

app.post('/events', validateBody(eventSchema), async (req, res) => {
  try {
    const input = eventSchema.parse(req.body);
    const event = await prisma.event.create({
      data: {
        title: input.title,
        date: new Date(`${input.date}T00:00:00.000Z`),
        location: input.location,
        capacity: input.capacity,
        description: input.description || null
      }
    });

    res.status(201).json({
      ...event,
      date: event.date.toISOString().slice(0, 10)
    });
  } catch (error) {
    console.error('Could not create event in the event database:', error);
    res.status(503).json({ error: 'Event database is unavailable' });
  }
});

app.listen(port, () => {
  console.log(`Event service running on http://localhost:${port}`);
});
