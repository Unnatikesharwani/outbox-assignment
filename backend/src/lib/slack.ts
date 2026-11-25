import { db } from './db';

// Looks up the user's Slack webhook and posts. No connection = silently skip.
export async function notifyUserSlack(userId: number, text: string) {
  const conn = await db('slack_connections').where({ user_id: userId }).first();
  if (!conn) return false;
  try {
    const res = await fetch(conn.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.warn(`[slack] webhook responded ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[slack] webhook failed:', (err as Error).message);
    return false;
  }
}
