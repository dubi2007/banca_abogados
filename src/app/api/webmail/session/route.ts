import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  decryptWebmailSession,
  encryptWebmailSession,
  resolveDefaultMailHosts,
  verifyImapLogin,
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

  const creds: WebmailCredentials = {
    email,
    password,
    ...resolveDefaultMailHosts(),
  };

  try {
    await verifyImapLogin(creds);
  } catch {
    return NextResponse.json(
      { error: 'No se pudo iniciar sesión. Verifique su correo y contraseña.' },
      { status: 401 },
    );
  }

  const token = encryptWebmailSession(creds);
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
    email: creds.email,
    imapHost: creds.imapHost,
    smtpHost: creds.smtpHost,
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(WEBMAIL_COOKIE);
  return NextResponse.json({ ok: true });
}
