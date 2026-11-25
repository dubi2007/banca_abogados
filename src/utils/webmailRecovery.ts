import { createHmac, randomBytes, randomInt } from 'node:crypto';

const corporateDomain = 'faynshteynjuridico.com';
const codeMinutes = 10;
const maxCodeAttempts = 5;
const challengeIdPattern = /^[a-f0-9]{32}$/;

type RecoveryPurpose = 'enroll' | 'reset';
type RecoveryProof = { challenge: string; code: string };
type RecoveryProvider = 'cPanel' | 'IMAP' | 'Resend' | 'Upstash';

export class WebmailRecoveryProviderError extends Error {
  constructor(provider: RecoveryProvider, detail: string, readonly status?: number) {
    super(`${provider}: ${detail}${status === undefined ? '' : ` (HTTP ${status})`}`);
  }
}

export function logWebmailRecoveryError(message: string, error: unknown) {
  if (error instanceof WebmailRecoveryProviderError) {
    console.error(message, error.message);
  } else {
    console.error(message);
  }
}

export function getWebmailRecoveryConfig() {
  const {
    WEBMAIL_RECOVERY_SECRET: secret,
    WEBMAIL_CPANEL_USERNAME,
    WEBMAIL_CPANEL_API_TOKEN,
    WEBMAIL_CPANEL_ORIGIN = 'https://cpanel.faynshteynjuridico.com:2083',
    UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: redisToken,
    RESEND_API_KEY: resendKey,
    WEBMAIL_RECOVERY_FROM: from,
  } = process.env;

  const cPanelUsername = WEBMAIL_CPANEL_USERNAME?.trim();
  const cPanelToken = WEBMAIL_CPANEL_API_TOKEN?.trim();
  const cPanel = httpsOrigin(WEBMAIL_CPANEL_ORIGIN);
  const redis = httpsOrigin(UPSTASH_REDIS_REST_URL);
  if (!secret || Buffer.byteLength(secret) < 32 || !cPanelUsername || !cPanelToken ||
      !cPanel || !redis || !redisToken || !resendKey || !from) {
    return null;
  }

  return { secret, cPanel, cPanelAuth: `cpanel ${cPanelUsername}:${cPanelToken}`, redis, redisToken, resendKey, from };
}

type RecoveryConfig = NonNullable<ReturnType<typeof getWebmailRecoveryConfig>>;

function httpsOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.search && !url.hash && url.pathname === '/' ? url.origin : null;
  } catch {
    return null;
  }
}

export function recoveryEmail(value: unknown) {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (email.length > 254 || !/^[\w.!#$%&'*+/=?^`{|}~-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email)) {
    return null;
  }
  const [local, domain] = email.split('@');
  return `${local}@${domain.toLowerCase()}`;
}

export function recoveryMailbox(value: unknown) {
  const email = recoveryEmail(value);
  return email?.endsWith(`@${corporateDomain}`) ? email.toLowerCase() : null;
}

export function createRecoveryChallenge() {
  return randomBytes(16).toString('hex');
}

export function recoveryProof(challenge: unknown, code: unknown): RecoveryProof | null {
  if (typeof challenge !== 'string' || !challengeIdPattern.test(challenge) ||
      typeof code !== 'string' || !/^\d{8}$/.test(code)) return null;
  return { challenge, code };
}

function digest(config: RecoveryConfig, ...parts: string[]) {
  return createHmac('sha256', config.secret).update(JSON.stringify(parts)).digest('hex');
}

function accountKey(config: RecoveryConfig, mailbox: string) {
  return `webmail:recovery:{${digest(config, 'mailbox', mailbox)}}`;
}

async function requestJson<T>(
  provider: RecoveryProvider,
  url: string,
  authorization: string,
  body?: string | URLSearchParams,
  timeoutMs = 8000,
): Promise<T> {
  const headers = new Headers({ Authorization: authorization, Accept: 'application/json' });
  if (typeof body === 'string') headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const detail = error instanceof Error && error.name === 'TimeoutError'
      ? 'request timed out'
      : 'connection failed';
    throw new WebmailRecoveryProviderError(provider, detail);
  }
  if (!response.ok) {
    throw new WebmailRecoveryProviderError(provider, 'request failed', response.status);
  }
  try {
    return await response.json();
  } catch {
    const detail = response.headers.get('content-type')?.startsWith('text/html')
      ? 'returned an HTML page'
      : 'returned invalid JSON';
    throw new WebmailRecoveryProviderError(provider, detail, response.status);
  }
}

async function redisCommand<T>(
  config: RecoveryConfig,
  command: (string | number)[],
  timeoutMs?: number,
): Promise<T> {
  const response = await requestJson<{ result: T; error?: string }>(
    'Upstash', config.redis, `Bearer ${config.redisToken}`, JSON.stringify(command), timeoutMs,
  );
  if (!response || response.error || !Object.hasOwn(response, 'result')) {
    throw new WebmailRecoveryProviderError('Upstash', 'command failed');
  }
  return response.result;
}

export async function needsWebmailRecoveryEmail(email: string) {
  const mailbox = recoveryMailbox(email);
  const config = getWebmailRecoveryConfig();
  if (!mailbox || !config) return false;

  try {
    const exists = await redisCommand<number>(
      config, ['HEXISTS', `${accountKey(config, mailbox)}:profile`, 'address'], 2000,
    );
    return exists === 0;
  } catch (error) {
    logWebmailRecoveryError('Webmail recovery email status check failed', error);
    return false;
  }
}

const incrementWithExpiry = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 3600) end
return count
`;

export async function allowRecoveryEnrollment(config: RecoveryConfig, mailbox: string) {
  const count = await redisCommand<number>(
    config, ['EVAL', incrementWithExpiry, 1, `${accountKey(config, mailbox)}:password-checks`],
  );
  return count <= 10;
}

const issueChallenge = `
local address = ARGV[2]
if ARGV[1] == 'reset' then address = redis.call('HGET', KEYS[2], 'address') end
if not address or redis.call('EXISTS', KEYS[3]) == 1 then return false end
if not redis.call('SET', KEYS[4], '1', 'EX', 60, 'NX') then return false end
local sends = redis.call('INCR', KEYS[5])
if sends == 1 then redis.call('EXPIRE', KEYS[5], 3600) end
if sends > 5 then return false end
local version = redis.call('HGET', KEYS[2], 'version') or ''
redis.call('HSET', KEYS[1], 'address', address, 'digest', ARGV[3],
  'binding', ARGV[4], 'version', version, 'attempts', 0)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[5]))
return address
`;

export async function sendWebmailRecoveryCode(
  config: RecoveryConfig,
  mailbox: string,
  challenge: string,
  language: 'es' | 'en',
  enrollment?: { address: string; session: string },
) {
  const purpose: RecoveryPurpose = enrollment ? 'enroll' : 'reset';
  const key = accountKey(config, mailbox);
  const code = String(randomInt(100_000_000)).padStart(8, '0');
  const address = await redisCommand<string | null>(config, [
    'EVAL', issueChallenge, 5,
    `${key}:${purpose}:${challenge}`, `${key}:profile`, `${key}:changing-password`,
    `${key}:${purpose}:cooldown`, `${key}:${purpose}:sends`,
    purpose, enrollment?.address ?? '', digest(config, purpose, mailbox, challenge, code),
    enrollment ? digest(config, 'session', enrollment.session) : '', codeMinutes * 60,
  ]);
  if (!address) return false;

  const english = language === 'en';
  const action = purpose === 'enroll'
    ? (english ? 'verify your recovery address' : 'verificar su correo de recuperación')
    : (english ? 'reset your mailbox password' : 'restablecer la contraseña de su buzón');
  const message = english
    ? `Your code to ${action} for ${mailbox} is ${code}.\n\nIt expires in ${codeMinutes} minutes.`
    : `Su código para ${action} de ${mailbox} es ${code}.\n\nVence en ${codeMinutes} minutos.`;
  const response = await requestJson<{ id?: string }>(
    'Resend', 'https://api.resend.com/emails', `Bearer ${config.resendKey}`, JSON.stringify({
      from: config.from,
      to: [address],
      subject: english ? 'Faynshteyn Webmail verification code' : 'Código de verificación de Faynshteyn Webmail',
      text: message,
    }),
  );
  if (!response?.id) throw new WebmailRecoveryProviderError('Resend', 'message was not accepted');
  return true;
}

// Advancing the profile version invalidates earlier codes, including an in-flight reset.
const consumeChallenge = `
if redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
local saved = redis.call('HMGET', KEYS[1], 'digest', 'binding', 'address', 'version')
local version = redis.call('HGET', KEYS[2], 'version') or ''
if not saved[1] or saved[2] ~= ARGV[3] or saved[4] ~= version then return 0 end
if saved[1] ~= ARGV[2] then
  local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
  if attempts >= tonumber(ARGV[5]) then redis.call('DEL', KEYS[1]) end
  return 0
end
if ARGV[6] == 'check' then return 1 end
if ARGV[1] == 'enroll' then
  redis.call('HSET', KEYS[2], 'address', saved[3])
  redis.call('DEL', KEYS[1])
else
  redis.call('SET', KEYS[3], ARGV[4], 'EX', 30)
end
redis.call('HSET', KEYS[2], 'version', ARGV[4])
return 1
`;

async function verifyWebmailRecoveryCode(
  config: RecoveryConfig,
  mailbox: string,
  purpose: RecoveryPurpose,
  { challenge, code }: RecoveryProof,
  version: string,
  { session, consume = true }: { session?: string; consume?: boolean } = {},
) {
  const key = accountKey(config, mailbox);
  const accepted = await redisCommand<number>(config, [
    'EVAL', consumeChallenge, 3,
    `${key}:${purpose}:${challenge}`, `${key}:profile`, `${key}:changing-password`,
    purpose, digest(config, purpose, mailbox, challenge, code),
    session ? digest(config, 'session', session) : '', version, maxCodeAttempts,
    consume ? 'consume' : 'check',
  ]);
  return accepted === 1;
}

export function verifyWebmailEnrollmentCode(
  config: RecoveryConfig,
  mailbox: string,
  proof: RecoveryProof,
  session: string,
  consume = true,
) {
  return verifyWebmailRecoveryCode(config, mailbox, 'enroll', proof, proof.challenge, { session, consume });
}

export async function beginWebmailPasswordReset(config: RecoveryConfig, mailbox: string, proof: RecoveryProof) {
  const attempt = createRecoveryChallenge();
  const accepted = await verifyWebmailRecoveryCode(config, mailbox, 'reset', proof, attempt);
  return accepted ? attempt : null;
}

// Restore only the rejected attempt, preserving its original expiry and invalidating other codes.
const restoreRejectedChallenge = `
if redis.call('GET', KEYS[3]) ~= ARGV[1] or redis.call('HGET', KEYS[2], 'version') ~= ARGV[1] then
  return 0
end
if redis.call('EXISTS', KEYS[1]) == 1 then
  redis.call('HSET', KEYS[1], 'version', ARGV[1])
end
redis.call('DEL', KEYS[3])
return 1
`;

export async function allowWebmailPasswordResetRetry(
  config: RecoveryConfig,
  mailbox: string,
  challenge: string,
  attempt: string,
) {
  const key = accountKey(config, mailbox);
  await redisCommand<number>(config, [
    'EVAL', restoreRejectedChallenge, 3,
    `${key}:reset:${challenge}`, `${key}:profile`, `${key}:changing-password`, attempt,
  ]);
}

export async function checkCPanelEmailAccess(config: RecoveryConfig) {
  try {
    const response = await requestJson<{ result?: { status: number } }>(
      'cPanel', `${config.cPanel}/execute/Email/get_default_email_quota`, config.cPanelAuth, undefined, 3000,
    );
    if (response?.result?.status === 1) {
      console.info('Webmail recovery cPanel read-only email request succeeded');
    } else {
      console.warn('Webmail recovery cPanel read-only email request was rejected');
    }
  } catch (error) {
    logWebmailRecoveryError('Webmail recovery cPanel email access check failed', error);
  }
}

export async function resetRecoveryMailboxPassword(
  config: RecoveryConfig,
  mailbox: string,
  password: string,
): Promise<'changed' | 'rejected' | 'denied'> {
  if (recoveryMailbox(mailbox) !== mailbox) throw new Error('Unmanaged mailbox');
  const [mailboxName] = mailbox.split('@');
  const form = new URLSearchParams({ email: mailboxName, domain: corporateDomain, password });
  let response: { result?: { status: number } };
  try {
    response = await requestJson<typeof response>(
      'cPanel', `${config.cPanel}/execute/Email/passwd_pop`, config.cPanelAuth, form,
    );
  } catch (error) {
    if (!(error instanceof WebmailRecoveryProviderError && (error.status === 401 || error.status === 403))) {
      throw error;
    }
    logWebmailRecoveryError('Webmail recovery password change denied', error);
    return 'denied';
  }
  const status = response?.result?.status;
  if (status !== 1 && status !== 0) {
    throw new WebmailRecoveryProviderError('cPanel', 'unexpected password change response');
  }
  return status === 1 ? 'changed' : 'rejected';
}
