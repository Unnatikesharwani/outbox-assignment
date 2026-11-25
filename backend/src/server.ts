import { config } from './config';
import { initDb } from './lib/db';
import { ensureSenders } from './lib/senders';
import { ensureIndex } from './lib/search';
import { reconcileQueue } from './queue/emailQueue';
import { startWorker } from './queue/worker';
import { buildApp } from './app';

async function main() {
  await initDb();
  await ensureSenders();
  await ensureIndex();
  await reconcileQueue();

  if (config.runWorker) startWorker();

  buildApp().listen(config.port, () => {
    console.log(`[api] listening on :${config.port}  |  queue dashboard: ${config.backendUrl}/admin/queues`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
