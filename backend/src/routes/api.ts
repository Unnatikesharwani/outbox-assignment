import { Router } from 'express';
import { z } from 'zod';
import { db, EmailRow } from '../lib/db';
import { enqueueEmails } from '../queue/emailQueue';
import { indexEmails, searchEmails } from '../lib/search';
import { requireAuth } from './auth';
import { config } from '../config';

export const apiRouter = Router();
apiRouter.use(requireAuth);

apiRouter.get('/me', async (_req, res) => {
  const user = await db('users').where({ id: res.locals.userId }).first('id', 'name', 'email', 'avatar');
  res.json(user);
});

// ---------- scheduling ----------
const scheduleSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  recipients: z.array(z.string().email()).min(1).max(10000),
  startTime: z.string().datetime(),
  delaySeconds: z.number().min(0).max(86400),
  hourlyLimit: z.number().int().min(1).max(100000).optional(),
});

apiRouter.post('/emails/schedule', async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ') });
  }
  const { subject, body, recipients, startTime, delaySeconds, hourlyLimit } = parsed.data;

  const senders = await db('senders').select('id').orderBy('id');
  if (!senders.length) return res.status(500).json({ error: 'No senders configured' });

  const start = new Date(startTime).getTime();
  const unique = [...new Set(recipients.map((r) => r.toLowerCase()))];

  // Emails are spaced `delaySeconds` apart from startTime; senders are used round-robin.
  const rows = unique.map((to, i) => ({
    user_id: res.locals.userId,
    sender_id: senders[i % senders.length].id,
    to_email: to,
    subject,
    body,
    scheduled_at: new Date(start + i * delaySeconds * 1000),
    status: 'scheduled',
    hourly_limit: hourlyLimit ?? config.maxEmailsPerHourPerSender,
  }));

  const inserted: EmailRow[] = [];
  await db.transaction(async (trx) => {
    for (let i = 0; i < rows.length; i += 500) {
      inserted.push(...(await trx('emails').insert(rows.slice(i, i + 500)).returning('*')));
    }
  });

  // DB is the source of truth; if enqueueing fails, the boot-time reconcile picks the rows up.
  await enqueueEmails(inserted);
  await indexEmails(inserted);
  res.status(201).json({ scheduled: inserted.length, duplicatesRemoved: recipients.length - unique.length });
});

// ---------- listing + search ----------
const GROUPS: Record<string, string[]> = { scheduled: ['scheduled', 'sending'], sent: ['sent', 'failed'] };

apiRouter.get('/emails', async (req, res) => {
  const group = String(req.query.status ?? 'scheduled');
  const statuses = GROUPS[group];
  if (!statuses) return res.status(400).json({ error: 'status must be scheduled or sent' });
  const q = String(req.query.q ?? '').trim();
  const userId = res.locals.userId as number;

  if (q) {
    try {
      return res.json({ items: await searchEmails(userId, q, statuses) });
    } catch (err) {
      console.warn('[search] ES unavailable, falling back to SQL:', (err as Error).message);
      const like = `%${q}%`;
      const items = await db('emails')
        .where({ user_id: userId })
        .whereIn('status', statuses)
        .andWhere((b) => b.whereILike('to_email', like).orWhereILike('subject', like))
        .orderBy('scheduled_at')
        .limit(100);
      return res.json({ items });
    }
  }

  const isSent = group === 'sent';
  const items = await db('emails')
    .where({ user_id: userId })
    .whereIn('status', statuses)
    .orderBy(isSent ? 'sent_at' : 'scheduled_at', isSent ? 'desc' : 'asc')
    .limit(500)
    .select('id', 'to_email', 'subject', 'scheduled_at', 'sent_at', 'status', 'error', 'preview_url');
  res.json({ items });
});

// ---------- slack status ----------
apiRouter.get('/slack', async (_req, res) => {
  const conn = await db('slack_connections').where({ user_id: res.locals.userId }).first('channel', 'team_name');
  res.json({ connected: !!conn, channel: conn?.channel ?? null, team: conn?.team_name ?? null });
});

apiRouter.delete('/slack', async (_req, res) => {
  await db('slack_connections').where({ user_id: res.locals.userId }).del();
  res.json({ ok: true });
});
