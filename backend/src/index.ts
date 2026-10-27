import { app, port } from './app.js';

app.listen(port, () => {
  console.log(`Event Manager API gateway running on http://localhost:${port}`);
});
