import type { Email, EmailTab, ScheduleRequest, ScheduleResponse, SlackStatus, User } from '../types';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? 'Something went wrong', res.status);
  }
  return res.json();
}

export const api = {
  me: () => request<User>('/api/me'),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  listEmails: (tab: EmailTab, q = '') =>
    request<{ items: Email[] }>(`/api/emails?status=${tab}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  schedule: (payload: ScheduleRequest) =>
    request<ScheduleResponse>('/api/emails/schedule', { method: 'POST', body: JSON.stringify(payload) }),
  slackStatus: () => request<SlackStatus>('/api/slack'),
  slackAuthUrl: () => request<{ url: string }>('/auth/slack'),
  slackDisconnect: () => request<{ ok: true }>('/api/slack', { method: 'DELETE' }),
};
