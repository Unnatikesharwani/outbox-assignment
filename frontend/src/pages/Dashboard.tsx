import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { EmailTable } from '../components/EmailTable';
import { ComposeModal } from '../components/ComposeModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useEmails } from '../hooks/useEmails';
import type { EmailTab, User } from '../types';

const TABS: { id: EmailTab; label: string }[] = [
  { id: 'scheduled', label: 'Scheduled emails' },
  { id: 'sent', label: 'Sent emails' },
];

export function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<EmailTab>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const { items, loading, error, reload } = useEmails(tab, debounced);

  // wait for the user to stop typing before hitting the search API
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openCompose = () => setComposeOpen(true);

  return (
    <div className="min-h-screen">
      <Header user={user} onLogout={onLogout} />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-ink-100 p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tab === t.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search address or subject"
              className="w-64"
              aria-label="Search emails"
            />
            <Button onClick={openCompose}>Compose new email</Button>
          </div>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-ink-100">
          <EmailTable
            tab={tab}
            items={items}
            loading={loading}
            error={error}
            isSearching={!!debounced}
            emptyAction={<Button onClick={openCompose}>Compose new email</Button>}
          />
        </div>
      </main>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onScheduled={() => { setTab('scheduled'); reload(); }} />
    </div>
  );
}
