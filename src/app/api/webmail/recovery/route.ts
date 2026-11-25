import { isIP } from 'node:net';
import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import {
  decryptWebmailSession,
  resolveDefaultMailHosts,
  verifyImapLogin,
  WEBMAIL_COOKIE,
} from '../../../../utils/webmail';
import {
  allowRecoveryEnrollment,
  createRecoveryChallenge,
  getWebmailRecoveryConfig,
  logWebmailRecoveryError,
  recoveryEmail,
  recoveryMailbox,
  recoveryProof,
  resetRecoveryMailboxPassword,
  sendWebmailRecoveryCode,
  verifyWebmailRecoveryCode,
  WebmailRecoveryProviderError,
} from '../../../../utils/webmailRecovery';

export const runtime = 'nodejs';
export const maxDuration = 45;

function json(body: { error: string } | { ok: true; challenge?: string }, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (!origin || (fetchSite && fetchSite !== 'same-origin')) return false;

  try {
    const source = new URL(origin);
    return source.origin === origin && source.host === request.headers.get('host') &&
      (source.protocol === 'https:' ||
        (process.env.NODE_ENV !== 'production' && source.protocol === 'http:'));
  } catch {
    return false;
  }
}

function validPassword(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max &&
    !/[\r\n\0]/.test(value);
}

async function verifyEnrollmentPassword(mailbox: string, password: string, cPanelOrigin: string) {
  const hosts = resolveDefaultMailHosts();
  const tlsServerName = isIP(hosts.imapHost) ? new URL(cPanelOrigin).hostname : hosts.imapHost;
  try {
    await verifyImapLogin({ email: mailbox, password, ...hosts }, { tlsServerName });
    return true;
  } catch (error) {
    if (error instanceof Error && /^NO(?: |$)/.test(error.message)) return false;
    throw new WebmailRecoveryProviderError('IMAP', 'mailbox verification failed');
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'origin' }, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return json({ error: 'invalid' }, 415);
  }

  if (Number(request.headers.get('content-length')) > 8192) return json({ error: 'invalid' }, 413);
  const raw = await request.text().catch(() => '');
  if (Buffer.byteLength(raw) > 8192) return json({ error: 'invalid' }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'invalid' }, 400);
  }

  const config = getWebmailRecoveryConfig();
  if (!config) return json({ error: 'unavailable' }, 503);
  const language = body.language === 'en' ? 'en' : 'es';

  try {
    if (body.action === 'request_reset') {
      const mailbox = recoveryMailbox(body.mailbox);
      if (!mailbox) return json({ error: 'mailbox' }, 400);
      const challenge = createRecoveryChallenge();
      // Every valid request receives the same response regardless of enrollment or delivery.
      after(async () => {
        try {
          await sendWebmailRecoveryCode(config, mailbox, challenge, language);
        } catch (error) {
          logWebmailRecoveryError('Webmail recovery code delivery failed', error);
        }
      });
      return json({ ok: true, challenge }, 202);
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(WEBMAIL_COOKIE)?.value;
    const session = decryptWebmailSession(token);
    const sessionMailbox = recoveryMailbox(session?.email);

    if (body.action === 'complete_reset') {
      const mailbox = recoveryMailbox(body.mailbox);
      const proof = recoveryProof(body.challenge, body.code);
      if (!mailbox) return json({ error: 'mailbox' }, 400);
      if (!validPassword(body.password, 12, 128)) return json({ error: 'new_password' }, 400);
      if (!proof || !await verifyWebmailRecoveryCode(config, mailbox, 'reset', proof)) {
        return json({ error: 'code' }, 400);
      }
      if (!await resetRecoveryMailboxPassword(config, mailbox, body.password)) {
        return json({ error: 'password_rejected' }, 422);
      }
      if (sessionMailbox === mailbox) cookieStore.delete(WEBMAIL_COOKIE);
      return json({ ok: true });
    }

    if (body.action !== 'request_enrollment' && body.action !== 'complete_enrollment') {
      return json({ error: 'invalid' }, 400);
    }
    if (!token || !session || !sessionMailbox) return json({ error: 'sign_in' }, 401);

    if (body.action === 'request_enrollment') {
      const address = recoveryEmail(body.address);
      if (!address || address.toLowerCase() === sessionMailbox) return json({ error: 'address' }, 400);
      if (!validPassword(body.password, 1, 512) || body.password !== session.password) {
        return json({ error: 'current_password' }, 403);
      }
      if (!await allowRecoveryEnrollment(config, sessionMailbox)) return json({ error: 'throttled' }, 429);
      if (!await verifyEnrollmentPassword(sessionMailbox, body.password, config.cPanel)) {
        return json({ error: 'current_password' }, 403);
      }
      const challenge = createRecoveryChallenge();
      const sent = await sendWebmailRecoveryCode(config, sessionMailbox, challenge, language, {
        address, session: token,
      });
      return sent ? json({ ok: true, challenge }, 202) : json({ error: 'throttled' }, 429);
    }

    const proof = recoveryProof(body.challenge, body.code);
    if (!proof || !await verifyWebmailRecoveryCode(
      config, sessionMailbox, 'enroll', proof, { session: token, consume: false },
    )) {
      return json({ error: 'code' }, 400);
    }
    if (!await verifyEnrollmentPassword(sessionMailbox, session.password, config.cPanel)) {
      return json({ error: 'current_password' }, 403);
    }
    if (!await verifyWebmailRecoveryCode(config, sessionMailbox, 'enroll', proof, { session: token })) {
      return json({ error: 'code' }, 400);
    }
    return json({ ok: true });
  } catch (error) {
    logWebmailRecoveryError('Webmail recovery service request failed', error);
    return json({ error: 'service' }, 502);
  }
}
