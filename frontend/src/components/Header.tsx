import type { User } from '../types';
import { Button } from './ui/Button';
import { SlackButton } from './SlackButton';

export function Header({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight text-brand-700">Outbox</h1>
        <div className="flex items-center gap-4">
          <SlackButton />
          <div className="flex items-center gap-3">
            {user.avatar ? (
              <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                {user.name[0]}
              </div>
            )}
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-ink-500">{user.email}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
