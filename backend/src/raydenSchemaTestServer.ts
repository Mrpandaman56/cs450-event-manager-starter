import express from 'express';
import { raydenEventSchema } from './schemas/raydenEventSchema.js';

const app = express();
app.use(express.json());

app.post('/rayden-events', (request, response) => {
  const result = raydenEventSchema.safeParse(request.body);

  if (!result.success) {
    response.status(400).json({
      error: 'Invalid event data',
      details: result.error.flatten().fieldErrors
    });
    return;
  }

  response.status(201).json({
    message: 'Event data is valid',
    event: result.data
  });
});

app.listen(4003, () => {
  console.log('Rayden schema test server running at http://localhost:4003');
});