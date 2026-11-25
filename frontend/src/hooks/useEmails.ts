import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { Email, EmailTab } from '../types';

const POLL_MS = 5000;

/** Loads one tab's emails, keeps them fresh by polling, and re-fetches when tab/search changes. */
export function useEmails(tab: EmailTab, query: string) {
  const [items, setItems] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      try {
        const { items } = await api.listEmails(tab, query);
        if (id === requestId.current) {
          setItems(items);
          setError(null);
        }
      } catch (e) {
        if (id === requestId.current) setError((e as Error).message);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [tab, query]
  );

  useEffect(() => {
    setItems([]);
    load();
    const timer = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { items, loading, error, reload: () => load() };
}
