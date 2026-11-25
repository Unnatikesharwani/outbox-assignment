import nodemailer from 'nodemailer';
import { db, SenderRow } from './db';
import { config } from '../config';

// Creates throw-away Ethereal accounts the first time the app boots.
export async function ensureSenders() {
  const [{ count }] = await db('senders').count<{ count: string }[]>('id as count');
  const missing = config.senderCount - Number(count);
  for (let i = 0; i < missing; i++) {
    const acc = await nodemailer.createTestAccount();
    await db('senders').insert({
      email: acc.user,
      smtp_host: acc.smtp.host,
      smtp_port: acc.smtp.port,
      smtp_user: acc.user,
      smtp_pass: acc.pass,
    });
    console.log(`[senders] created Ethereal sender ${acc.user}`);
  }
}

const transports = new Map<number, nodemailer.Transporter>();

export function getTransport(sender: SenderRow) {
  let t = transports.get(sender.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: sender.smtp_host,
      port: sender.smtp_port,
      secure: false,
      auth: { user: sender.smtp_user, pass: sender.smtp_pass },
      pool: true,
    });
    transports.set(sender.id, t);
  }
  return t;
}
