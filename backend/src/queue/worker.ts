import { DelayedError, Job, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { config } from '../config';
import { db, EmailRow, SenderRow } from '../lib/db';
import { redis } from '../lib/redis';
import { getTransport } from '../lib/senders';
import { takeSlot, releaseSlot } from '../lib/rateLimiter';
import { notifyUserSlack } from '../lib/slack';
import { indexEmails } from '../lib/search';
import { EmailJobData, QUEUE_NAME } from './emailQueue';

async function reindex(id: number) {
  const row = await db<EmailRow>('emails').where({ id }).first();
  if (row) await indexEmails([row]);
}

async function processEmail(job: Job<EmailJobData>, token?: string) {
  const { emailId } = job.data;
  const email = await db<EmailRow>('emails').where({ id: emailId }).first();
  if (!email || email.status === 'sent' || email.status === 'failed') return; // already handled

  // Second layer of idempotency: atomically claim the row. A stalled job that gets picked
  // up again finds it claimed and bails out instead of double-sending.
  const claimed = await db('emails')
    .where({ id: emailId })
    .andWhere((q) =>
      q
        .where('status', 'scheduled')
        .orWhere((s) => s.where('status', 'sending').andWhereRaw(`updated_at < now() - interval '2 minutes'`))
    )
    .update({ status: 'sending', updated_at: db.fn.now() })
    .returning('id');
  if (!claimed.length) return;

  const limit = email.hourly_limit ?? config.maxEmailsPerHourPerSender;
  const slot = await takeSlot(email.sender_id, limit);
  const slotTakenAt = Date.now();

  if (!slot.allowed) {
    // Not a failure: push the job into the next hour window and keep it 'scheduled'.
    const retryAt = new Date(slot.retryAt!);
    await db('emails')
      .where({ id: emailId })
      .update({ status: 'scheduled', scheduled_at: retryAt, updated_at: db.fn.now() });
    await reindex(emailId);
    if (slot.firstHit) {
      const sender = await db<SenderRow>('senders').where({ id: email.sender_id }).first();
      await notifyUserSlack(
        email.user_id,
        `:warning: Hourly limit reached for sender *${sender?.email}* (${slot.limit}/hour). ` +
          `Remaining emails are paused and will resume at ${retryAt.toISOString()}.`
      );
    }
    await job.moveToDelayed(slot.retryAt!, token);
    throw new DelayedError();
  }

  const sender = (await db<SenderRow>('senders').where({ id: email.sender_id }).first())!;
  try {
    const info = await getTransport(sender).sendMail({
      from: sender.email,
      to: email.to_email,
      subject: email.subject,
      text: email.body,
      messageId: `<email-${email.id}@scheduler.local>`,
    });
    await db('emails')
      .where({ id: emailId })
      .update({
        status: 'sent',
        sent_at: db.fn.now(),
        preview_url: nodemailer.getTestMessageUrl(info) || null,
        error: null,
        updated_at: db.fn.now(),
      });
    await reindex(emailId);
  } catch (err) {
    await releaseSlot(email.sender_id, slotTakenAt);
    const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await db('emails')
      .where({ id: emailId })
      .update({
        status: isLastAttempt ? 'failed' : 'scheduled',
        sent_at: isLastAttempt ? db.fn.now() : null,
        error: (err as Error).message,
        updated_at: db.fn.now(),
      });
    await reindex(emailId);
    throw err; // lets BullMQ apply backoff / mark failed
  }
}

export function startWorker() {
  const worker = new Worker<EmailJobData>(QUEUE_NAME, processEmail, {
    connection: redis,
    concurrency: config.worker.concurrency,
    // Global (Redis-backed) throttle: at most 1 job per minDelayMs across ALL workers.
    limiter: { max: 1, duration: config.worker.minDelayMs },
  });
  worker.on('failed', (job, err) => console.warn(`[worker] job ${job?.id} failed: ${err.message}`));
  worker.on('error', (err) => console.error('[worker] error', err));
  console.log(`[worker] started (concurrency=${config.worker.concurrency}, minDelay=${config.worker.minDelayMs}ms)`);
  return worker;
}
