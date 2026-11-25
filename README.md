<<<<<<< HEAD
# Outbox – email scheduler (BullMQ + Redis + Postgres + Elasticsearch)

Express/TypeScript API, BullMQ worker, Ethereal SMTP, React + Tailwind dashboard.

## Run it

```bash
docker compose up -d                 # redis, postgres, elasticsearch
cd backend && cp .env.example .env   # fill Google (+ Slack) credentials
npm install && npm run dev           # API + worker on :4000
cd ../frontend && npm install && npm run dev   # dashboard on :5173
```

* Google OAuth: create a Web client, authorised redirect URI `http://localhost:4000/auth/google/callback`.
* Slack OAuth: create a Slack app with the `incoming-webhook` scope. Slack only accepts https redirects, so
  expose the backend with a tunnel (`ngrok http 4000`), set `BACKEND_URL` to the tunnel URL and register
  `{BACKEND_URL}/auth/slack/callback` in the Slack app.
* Senders: on first boot `SENDER_COUNT` Ethereal accounts are created and stored in the `senders` table.
  Open the "Preview" link on a sent row to see the message in Ethereal.
* BullMQ dashboard: `http://localhost:4000/admin/queues` (needs the logged-in cookie, so sign in first).
* Extra workers: `npm run build && RUN_WORKER=false npm start` for the API, `npm run worker` for each worker.

## How scheduling works (no cron anywhere)

1. `POST /api/emails/schedule` validates input (zod), de-duplicates addresses, and writes one `emails` row per
   recipient in a transaction. Row *i* gets `scheduled_at = startTime + i * delay`, senders are assigned round-robin.
2. Each row becomes a BullMQ **delayed job** with `jobId = email-<id>` and `delay = scheduled_at - now`.
3. Rows are indexed into Elasticsearch (`GET /api/emails?status=scheduled|sent&q=...`; falls back to SQL if ES is down).

## Persistence & restart safety

* Delayed jobs live in Redis (AOF enabled in docker-compose); the source of truth for each email is Postgres.
* On boot `reconcileQueue()` re-adds every `scheduled` row. The fixed `jobId` makes re-adding a no-op for jobs
  already in Redis, so nothing is duplicated and nothing starts over. Rows stuck in `sending` for >2 min
  (crashed worker) are returned to `scheduled`.

## Idempotency (never send twice)

1. Deterministic BullMQ `jobId` per email.
2. The worker atomically claims the row (`UPDATE ... WHERE status='scheduled'`); a second worker or a stalled-job
   replay gets 0 rows and exits. Rows already `sent`/`failed` are skipped.
3. Fixed SMTP `Message-ID` per email.

Known edge: if a process dies in the milliseconds between SMTP accepting the message and the DB update to `sent`,
the row is retried after the 2-minute stale window (at-least-once at that single point, as with any SMTP client).

## Concurrency, throttling and hourly limits

| Concern | Setting | How |
|---|---|---|
| Worker concurrency | `WORKER_CONCURRENCY` (default 5) | BullMQ `concurrency`; all shared state is in Postgres/Redis so parallel jobs are safe |
| Delay between sends | `MIN_DELAY_BETWEEN_EMAILS_MS` (**default 2000 = min 2 s between sends**) | BullMQ `limiter {max:1, duration}` – stored in Redis, so it applies across every worker/instance |
| Emails per hour | `MAX_EMAILS_PER_HOUR_PER_SENDER` (default 200) or the "Hourly limit" typed in Compose | Per-sender Redis counter `rl:count:<sender>:<hourWindow>` incremented by an atomic Lua script (check + INCR) |

When a sender's limit is hit the job is **not dropped or failed**: the row stays `scheduled`, `scheduled_at` is moved to
the start of the next hour window, and the job is moved there with `job.moveToDelayed`. Overflowing jobs get a position
from a Redis counter (`rl:over:...`) and are staggered by `position * minDelay` so their relative order is preserved.
If the next window is full too, the same logic runs again. A failed SMTP attempt releases its counter slot.

**1000+ emails at the same moment:** all jobs become due at once, the Redis limiter releases one every 2 s,
up to `WORKER_CONCURRENCY` are in flight, each sender stops at its hourly cap, and the overflow queues up behind
the next hour boundary in order. Nothing is lost and nothing blocks the event loop.

Trade-off: windows are fixed clock hours (cheap, atomic, easy to reason about) rather than a sliding window, so a
sender can burst `limit` emails at 10:59 and `limit` again at 11:00.

## Slack alerts

"Connect Slack" → `/auth/slack` returns the Slack authorize URL (signed `state` carries the user id) →
`/auth/slack/callback` exchanges the code and stores the incoming-webhook URL per user in `slack_connections`.
The first job blocked in each sender/hour window posts a real message to that webhook (`SET NX` ensures one alert per
window). No connection → the notification is skipped silently; connecting later works immediately, no redeploy.
Disconnect deletes the row.

## Layout

```
backend/src  config · lib (db, redis, rateLimiter, search, senders, slack) · queue (emailQueue, worker) · routes (auth, api)
frontend/src components/ui (Button, Input, Modal, Badge, Toast, Spinner, EmptyState) · components · hooks · pages · lib
```
=======
# outbox-assignment
>>>>>>> f671fcd2c1578dc9797671f10db2e637ae0763b8
