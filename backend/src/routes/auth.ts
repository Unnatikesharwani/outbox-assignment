import { Router, Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../lib/db';

export const authRouter = Router();

const google = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  `${config.backendUrl}/auth/google/callback`
);

const COOKIE = 'token';
const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, maxAge: 7 * 24 * 3600 * 1000 };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = jwt.verify(req.cookies[COOKIE], config.jwtSecret) as { uid: number };
    res.locals.userId = payload.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Not signed in' });
  }
}

authRouter.get('/google', (_req, res) => {
  res.redirect(google.generateAuthUrl({ scope: ['openid', 'email', 'profile'], prompt: 'select_account' }));
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    const { tokens } = await google.getToken(String(req.query.code));
    const ticket = await google.verifyIdToken({ idToken: tokens.id_token!, audience: config.google.clientId });
    const p = ticket.getPayload()!;

    const values = { google_id: p.sub, email: p.email!, name: p.name ?? p.email!, avatar: p.picture ?? null };
    const [user] = await db('users').insert(values).onConflict('google_id').merge().returning('id');

    res.cookie(COOKIE, jwt.sign({ uid: user.id }, config.jwtSecret, { expiresIn: '7d' }), cookieOpts);
    res.redirect(config.frontendUrl);
  } catch (err) {
    console.error('[auth] google callback failed', err);
    res.redirect(`${config.frontendUrl}/?error=login_failed`);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

// ---------- Slack OAuth ("Connect Slack") ----------
// `state` is a short-lived signed JWT carrying the user id, so the callback doesn't depend
// on the session cookie (Slack redirects to an https tunnel domain in dev).
authRouter.get('/slack', requireAuth, (_req, res) => {
  const state = jwt.sign({ uid: res.locals.userId }, config.jwtSecret, { expiresIn: '10m' });
  const params = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: 'incoming-webhook',
    redirect_uri: `${config.backendUrl}/auth/slack/callback`,
    state,
  });
  res.json({ url: `https://slack.com/oauth/v2/authorize?${params}` });
});

authRouter.get('/slack/callback', async (req, res) => {
  try {
    const { uid } = jwt.verify(String(req.query.state), config.jwtSecret) as { uid: number };
    const resp = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code: String(req.query.code),
        redirect_uri: `${config.backendUrl}/auth/slack/callback`,
      }),
    });
    const data: any = await resp.json();
    if (!data.ok) throw new Error(data.error);

    const row = {
      user_id: uid,
      webhook_url: data.incoming_webhook.url,
      channel: data.incoming_webhook.channel,
      team_name: data.team?.name,
    };
    await db('slack_connections').insert(row).onConflict('user_id').merge();
    res.redirect(`${config.frontendUrl}/?slack=connected`);
  } catch (err) {
    console.error('[auth] slack callback failed', err);
    res.redirect(`${config.frontendUrl}/?slack=error`);
  }
});
