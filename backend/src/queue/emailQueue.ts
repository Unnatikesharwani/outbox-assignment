import { Queue } from 'bullmq';
import { redis } from '../lib/redis';
import { db } from '../lib/db';

export const QUEUE_NAME = 'email-send';

export interface EmailJobData {
  emailId: number;
}

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 7 * 24 * 3600 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

// Deterministic job id => BullMQ ignores a second add for the same email (first layer of idempotency).
export const jobIdFor = (emailId: number) => `email-${emailId}`;

export async function enqueueEmails(items: { id: number; scheduled_at: Date }[]) {
  const CHUNK = 1000;
  for (let i = 0; i < items.length; i += CHUNK) {
    await emailQueue.addBulk(
      items.slice(i, i + CHUNK).map((e) => ({
        name: 'send',
        data: { emailId: e.id },
        opts: { jobId: jobIdFor(e.id), delay: Math.max(0, new Date(e.scheduled_at).getTime() - Date.now()) },
      }))
    );
  }
}

// Runs on boot. Anything still 'scheduled' in the DB is (re)enqueued; jobs that already
// exist in Redis are skipped because of the fixed jobId.
export async function reconcileQueue() {
  const reset = await db('emails')
    .where({ status: 'sending' })
    .andWhereRaw(`updated_at < now() - interval '2 minutes'`)
    .update({ status: 'scheduled', updated_at: db.fn.now() });
  const pending = await db('emails').where({ status: 'scheduled' }).select('id', 'scheduled_at');
  await enqueueEmails(pending);
  console.log(`[queue] reconciled ${pending.length} scheduled emails (${reset} stale 'sending' reset)`);
}
