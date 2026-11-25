import type { Email, EmailTab } from '../types';
import { formatDateTime } from '../lib/format';
import { StatusBadge } from './ui/Badge';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import type { ReactNode } from 'react';

interface Props {
  tab: EmailTab;
  items: Email[];
  loading: boolean;
  error: string | null;
  isSearching: boolean;
  emptyAction?: ReactNode;
}

export function EmailTable({ tab, items, loading, error, isSearching, emptyAction }: Props) {
  if (loading && !items.length) {
    return (
      <div className="flex justify-center py-20 text-brand-600">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }
  if (error && !items.length) {
    return <EmptyState title="Couldn’t load emails" description={error} />;
  }
  if (!items.length) {
    if (isSearching) return <EmptyState title="No matches" description="Try a different name, address or subject." />;
    return tab === 'scheduled' ? (
      <EmptyState title="Nothing scheduled" description="Compose an email and upload your leads to queue the first batch." action={emptyAction} />
    ) : (
      <EmptyState title="Nothing sent yet" description="Emails show up here as soon as they leave the queue." />
    );
  }

  const timeLabel = tab === 'scheduled' ? 'Scheduled for' : 'Sent at';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-100 text-ink-500">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">{timeLabel}</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {items.map((e) => (
            <tr key={e.id} className="hover:bg-ink-50">
              <td className="px-4 py-3 font-medium">{e.to_email}</td>
              <td className="max-w-xs truncate px-4 py-3 text-ink-700">{e.subject}</td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                {formatDateTime(tab === 'scheduled' ? e.scheduled_at : e.sent_at)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  {e.status === 'sent' && e.preview_url && (
                    <a href={e.preview_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">
                      Preview
                    </a>
                  )}
                  {e.status === 'failed' && e.error && <span className="max-w-[12rem] truncate text-xs text-red-600" title={e.error}>{e.error}</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
