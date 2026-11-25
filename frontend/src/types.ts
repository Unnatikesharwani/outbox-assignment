export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
}

export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed';
export type EmailTab = 'scheduled' | 'sent';

export interface Email {
  id: number;
  to_email: string;
  subject: string;
  scheduled_at: string;
  sent_at: string | null;
  status: EmailStatus;
  error: string | null;
  preview_url: string | null;
}

export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delaySeconds: number;
  hourlyLimit?: number;
}

export interface ScheduleResponse {
  scheduled: number;
  duplicatesRemoved: number;
}

export interface SlackStatus {
  connected: boolean;
  channel: string | null;
  team: string | null;
}
