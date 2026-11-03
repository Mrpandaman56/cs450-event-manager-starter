import dotenv from 'dotenv';
import { app } from './app.js';

dotenv.config();
const port = Number(process.env.PORT || 4001);

app.listen(port, () => {
  console.log(`Event Manager API gateway running on http://localhost:${port}`);
});
