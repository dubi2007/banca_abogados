import { createHmac, randomBytes, randomInt } from 'node:crypto';

const corporateDomain = 'faynshteynjuridico.com';
const codeMinutes = 10;
const maxCodeAttempts = 5;
const challengeIdPattern = /^[a-f0-9]{32}$/;

type RecoveryPurpose = 'enroll' | 'reset';

export function getWebmailRecoveryConfig() {
  const {
    WEBMAIL_RECOVERY_SECRET: secret,
    WEBMAIL_CPANEL_USERNAME: cPanelUsername,
    WEBMAIL_CPANEL_API_TOKEN: cPanelToken,
    WEBMAIL_CPANEL_ORIGIN = 'https://cpanel.faynshteynjuridico.com:2083',
    UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: redisToken,
    RESEND_API_KEY: resendKey,
    WEBMAIL_RECOVERY_FROM: from,
  } = process.env;

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

export function recoveryProof(challenge: unknown, code: unknown) {
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
  url: string,
  authorization: string,
  body: string | FormData,
  timeoutMs = 8000,
): Promise<T> {
  const headers = new Headers({ Authorization: authorization, Accept: 'application/json' });
  if (typeof body === 'string') headers.set('Content-Type', 'application/json');

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error('Recovery service unavailable');
  return response.json();
}

async function redisCommand<T>(
  config: RecoveryConfig,
  command: (string | number)[],
  timeoutMs?: number,
): Promise<T> {
  const response = await requestJson<{ result: T; error?: string }>(
    config.redis, `Bearer ${config.redisToken}`, JSON.stringify(command), timeoutMs,
  );
  if (response.error || !Object.hasOwn(response, 'result')) {
    throw new Error('Recovery storage unavailable');
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
  } catch {
    console.error('Webmail recovery email status check failed');
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
    'https://api.resend.com/emails', `Bearer ${config.resendKey}`, JSON.stringify({
      from: config.from,
      to: [address],
      subject: english ? 'Faynshteyn Webmail verification code' : 'Código de verificación de Faynshteyn Webmail',
      text: message,
    }),
  );
  if (!response.id) throw new Error('Recovery message was not accepted');
  return true;
}

// Advancing the profile version invalidates all earlier codes for the mailbox.
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
else
  redis.call('SET', KEYS[3], '1', 'EX', 30)
end
redis.call('HSET', KEYS[2], 'version', ARGV[4])
redis.call('DEL', KEYS[1])
return 1
`;

export async function verifyWebmailRecoveryCode(
  config: RecoveryConfig,
  mailbox: string,
  purpose: RecoveryPurpose,
  { challenge, code }: { challenge: string; code: string },
  { session, consume = true }: { session?: string; consume?: boolean } = {},
) {
  const key = accountKey(config, mailbox);
  const accepted = await redisCommand<number>(config, [
    'EVAL', consumeChallenge, 3,
    `${key}:${purpose}:${challenge}`, `${key}:profile`, `${key}:changing-password`,
    purpose, digest(config, purpose, mailbox, challenge, code),
    session ? digest(config, 'session', session) : '', challenge, maxCodeAttempts,
    consume ? 'consume' : 'check',
  ]);
  return accepted === 1;
}

async function callEmailApi(
  config: RecoveryConfig,
  action: 'verify_password' | 'passwd_pop',
  mailbox: string,
  password: string,
) {
  if (recoveryMailbox(mailbox) !== mailbox) throw new Error('Unmanaged mailbox');
  const form = new FormData();
  form.set('email', mailbox);
  form.set('password', password);
  if (action === 'passwd_pop') form.set('domain', corporateDomain);
  const response = await requestJson<{ result?: { status: number; data?: unknown } }>(
    `${config.cPanel}/execute/Email/${action}`, config.cPanelAuth, form,
  );
  if (response.result?.status !== 1 && response.result?.status !== 0) {
    throw new Error('Unexpected mailbox provider response');
  }
  return response.result;
}

export async function verifyRecoveryMailboxPassword(config: RecoveryConfig, mailbox: string, password: string) {
  const result = await callEmailApi(config, 'verify_password', mailbox, password);
  return result.status === 1 && result.data === 1;
}

export async function resetRecoveryMailboxPassword(config: RecoveryConfig, mailbox: string, password: string) {
  const result = await callEmailApi(config, 'passwd_pop', mailbox, password);
  return result.status === 1;
}
