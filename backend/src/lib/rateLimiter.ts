import { redis } from './redis';
import { config } from '../config';

const HOUR_MS = 60 * 60 * 1000;
const TTL_SECONDS = 2 * 60 * 60;

// Atomic check-and-increment so parallel workers/instances can't overshoot the limit.
const TAKE_SLOT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current >= tonumber(ARGV[1]) then return 0 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
`;

export interface SlotResult {
  allowed: boolean;
  /** epoch ms when a blocked job should be retried */
  retryAt?: number;
  /** true only for the first job blocked in this window – used to fire one Slack alert */
  firstHit?: boolean;
  limit: number;
}

export async function takeSlot(senderId: number, limit: number): Promise<SlotResult> {
  const windowId = Math.floor(Date.now() / HOUR_MS);
  const ok = await redis.eval(TAKE_SLOT, 1, `rl:count:${senderId}:${windowId}`, limit, TTL_SECONDS);
  if (ok === 1) return { allowed: true, limit };

  // Overflow jobs go to the start of the next window, staggered by their overflow
  // position so they keep roughly the same relative order.
  const overKey = `rl:over:${senderId}:${windowId}`;
  const position = await redis.incr(overKey);
  await redis.expire(overKey, TTL_SECONDS);
  const retryAt = (windowId + 1) * HOUR_MS + (position - 1) * config.worker.minDelayMs;

  const firstHit = (await redis.set(`rl:alerted:${senderId}:${windowId}`, '1', 'EX', TTL_SECONDS, 'NX')) === 'OK';
  return { allowed: false, retryAt, firstHit, limit };
}

// Undo a taken slot (used when the SMTP send fails and the job will retry).
export async function releaseSlot(senderId: number, takenAtMs: number) {
  const windowId = Math.floor(takenAtMs / HOUR_MS);
  await redis.decr(`rl:count:${senderId}:${windowId}`);
}
