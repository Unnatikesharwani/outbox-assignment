import type { EmailStatus } from '../../types';

const styles: Record<EmailStatus, string> = {
  scheduled: 'bg-amber-50 text-amber-700',
  sending: 'bg-sky-50 text-sky-700',
  sent: 'bg-brand-50 text-brand-700',
  failed: 'bg-red-50 text-red-700',
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
