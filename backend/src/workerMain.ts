// Standalone worker process – run several of these to scale horizontally.
// Redis-backed limiter + rate counters keep them coordinated.
import { initDb } from './lib/db';
import { startWorker } from './queue/worker';

initDb().then(startWorker).catch((e) => {
  console.error(e);
  process.exit(1);
});
