import dotenv from 'dotenv';
import { app, port } from './app.js';

dotenv.config();

app.listen(port, () => {
  console.log(`Event service running on http://localhost:${port}`);
});
