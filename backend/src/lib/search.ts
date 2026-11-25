import { Client } from '@elastic/elasticsearch';
import { config } from '../config';
import { EmailRow } from './db';

const INDEX = 'emails';
export const es = new Client({ node: config.esUrl });

export async function ensureIndex() {
  try {
    const exists = await es.indices.exists({ index: INDEX });
    if (!exists) {
      await es.indices.create({
        index: INDEX,
        mappings: {
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            to_email: { type: 'text', fields: { raw: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduled_at: { type: 'date' },
            sent_at: { type: 'date' },
          },
        },
      });
    }
  } catch (err) {
    console.warn('[es] could not prepare index, search will fall back to SQL:', (err as Error).message);
  }
}

const toDoc = (r: EmailRow) => ({
  id: r.id,
  user_id: r.user_id,
  sender_id: r.sender_id,
  to_email: r.to_email,
  subject: r.subject,
  body: r.body,
  status: r.status,
  scheduled_at: r.scheduled_at,
  sent_at: r.sent_at,
  error: r.error,
  preview_url: r.preview_url,
});

// Indexing must never break the send path, so every call swallows errors.
export async function indexEmails(rows: EmailRow[]) {
  if (!rows.length) return;
  try {
    const operations = rows.flatMap((r) => [{ index: { _index: INDEX, _id: String(r.id) } }, toDoc(r)]);
    await es.bulk({ operations, refresh: false });
  } catch (err) {
    console.warn('[es] index failed:', (err as Error).message);
  }
}

export async function searchEmails(userId: number, q: string, statuses: string[], size = 100) {
  const res = await es.search({
    index: INDEX,
    size,
    sort: [{ scheduled_at: 'asc' }],
    query: {
      bool: {
        filter: [{ term: { user_id: userId } }, { terms: { status: statuses } }],
        must: [
          {
            multi_match: {
              query: q,
              fields: ['to_email^2', 'subject', 'body'],
              fuzziness: 'AUTO',
            },
          },
        ],
      },
    },
  });
  return res.hits.hits.map((h) => h._source as Record<string, unknown>);
}
