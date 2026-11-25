import knex from 'knex';
import { config } from '../config';

export const db = knex({ client: 'pg', connection: config.databaseUrl, pool: { min: 2, max: 20 } });

export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed';

export interface EmailRow {
  id: number;
  user_id: number;
  sender_id: number;
  to_email: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  status: EmailStatus;
  sent_at: Date | null;
  error: string | null;
  preview_url: string | null;
  hourly_limit: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SenderRow {
  id: number;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
}

// Small bootstrap instead of a full migration framework – idempotent, runs on every boot.
export async function initDb() {
  if (!(await db.schema.hasTable('users'))) {
    await db.schema.createTable('users', (t) => {
      t.increments('id');
      t.string('google_id').notNullable().unique();
      t.string('email').notNullable();
      t.string('name').notNullable();
      t.string('avatar');
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }
  if (!(await db.schema.hasTable('senders'))) {
    await db.schema.createTable('senders', (t) => {
      t.increments('id');
      t.string('email').notNullable().unique();
      t.string('smtp_host').notNullable();
      t.integer('smtp_port').notNullable();
      t.string('smtp_user').notNullable();
      t.string('smtp_pass').notNullable();
    });
  }
  if (!(await db.schema.hasTable('emails'))) {
    await db.schema.createTable('emails', (t) => {
      t.increments('id');
      t.integer('user_id').notNullable().references('users.id');
      t.integer('sender_id').notNullable().references('senders.id');
      t.string('to_email').notNullable();
      t.string('subject').notNullable();
      t.text('body').notNullable();
      t.timestamp('scheduled_at').notNullable();
      t.string('status').notNullable().defaultTo('scheduled');
      t.timestamp('sent_at');
      t.text('error');
      t.string('preview_url');
      t.integer('hourly_limit');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
      t.index(['user_id', 'status', 'scheduled_at']);
    });
  }
  if (!(await db.schema.hasTable('slack_connections'))) {
    await db.schema.createTable('slack_connections', (t) => {
      t.integer('user_id').primary().references('users.id');
      t.text('webhook_url').notNullable();
      t.string('channel');
      t.string('team_name');
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }
}
