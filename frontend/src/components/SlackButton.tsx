import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SlackStatus } from '../types';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

export function SlackButton() {
  const toast = useToast();
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.slackStatus().then(setStatus).catch(() => setStatus({ connected: false, channel: null, team: null }));

    // After the OAuth round-trip Slack sends the user back with ?slack=connected|error
    const params = new URLSearchParams(window.location.search);
    const result = params.get('slack');
    if (result) {
      toast(result === 'connected' ? 'Slack connected. Rate-limit alerts will land there.' : 'Slack connection failed. Try again.', result === 'connected' ? 'success' : 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api.slackAuthUrl();
      window.location.href = url;
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.slackDisconnect();
      setStatus({ connected: false, channel: null, team: null });
      toast('Slack disconnected');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  return status.connected ? (
    <Button variant="ghost" onClick={disconnect} loading={busy} title={`Alerts go to ${status.channel ?? 'Slack'}`}>
      Slack: {status.channel ?? 'connected'} · Disconnect
    </Button>
  ) : (
    <Button variant="secondary" onClick={connect} loading={busy}>
      Connect Slack
    </Button>
  );
}
