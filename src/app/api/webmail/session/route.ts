import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  decryptWebmailSession,
  discoverWorkingImapConfig,
  encryptWebmailSession,
  resolveDefaultMailHosts,
  WEBMAIL_COOKIE,
  type WebmailCredentials,
} from '../../../../utils/webmail';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(WEBMAIL_COOKIE)?.value;
  const creds = decryptWebmailSession(token);
  if (!creds) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({
    authenticated: true,
    email: creds.email,
    imapHost: creds.imapHost,
    imapPort: creds.imapPort,
    smtpHost: creds.smtpHost,
    smtpPort: creds.smtpPort,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json(
      { error: 'Ingrese su correo corporativo y contraseña.' },
      { status: 400 },
    );
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    return NextResponse.json(
      { error: 'Formato de correo o contraseña inválido.' },
      { status: 400 },
    );
  }

  const defaults = resolveDefaultMailHosts(email);
  const creds: WebmailCredentials = {
    email,
    password,
    imapHost: typeof body.imapHost === 'string' && body.imapHost.trim() ? body.imapHost.trim() : defaults.imapHost,
    imapPort: Number(body.imapPort) > 0 ? Number(body.imapPort) : defaults.imapPort,
    smtpHost: typeof body.smtpHost === 'string' && body.smtpHost.trim() ? body.smtpHost.trim() : defaults.smtpHost,
    smtpPort: Number(body.smtpPort) > 0 ? Number(body.smtpPort) : defaults.smtpPort,
  };

  let verifiedCreds: WebmailCredentials;
  try {
    verifiedCreds = await discoverWorkingImapConfig(creds);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Error de autenticación IMAP';
    return NextResponse.json(
      {
        error: `No se pudo conectar al servidor IMAP. Si su dominio usa Cloudflare o un servidor compartido, abra "Configuración de servidor IMAP / SMTP (cPanel)" e ingrese la IP o el nombre del servidor de su cPanel (ej. el host que aparece en cPanel > Cuentas de correo > Connect Devices). Detalle: ${detail}`,
      },
      { status: 401 },
    );
  }

  const token = encryptWebmailSession(verifiedCreds);
  const cookieStore = await cookies();
  cookieStore.set(WEBMAIL_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });

  return NextResponse.json({
    ok: true,
    email: verifiedCreds.email,
    imapHost: verifiedCreds.imapHost,
    smtpHost: verifiedCreds.smtpHost,
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(WEBMAIL_COOKIE);
  return NextResponse.json({ ok: true });
}
