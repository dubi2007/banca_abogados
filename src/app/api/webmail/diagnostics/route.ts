import dns from 'node:dns/promises';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  decryptWebmailSession,
  diagnoseDomainEmailDns,
  fetchImapMailboxState,
  sendSmtpEmail,
  WEBMAIL_COOKIE,
} from '../../../../utils/webmail';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const creds = decryptWebmailSession(cookieStore.get(WEBMAIL_COOKIE)?.value);
  if (!creds) {
    return NextResponse.json({ error: 'Sesión expirada.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const sendSelfTest = Boolean(body?.sendSelfTest);

  const domain = creds.email.includes('@')
    ? creds.email.split('@')[1].trim().toLowerCase()
    : 'faynshteynjuridico.com';

  const [dnsDiag, rootIps, mailSubdomainIps, connectedHostIps, txtRecords] = await Promise.all([
    diagnoseDomainEmailDns(creds.email),
    dns.resolve4(domain).catch(() => [] as string[]),
    dns.resolve4(`mail.${domain}`).catch(() => [] as string[]),
    dns.resolve4(creds.imapHost).catch(() => [creds.imapHost]),
    dns.resolveTxt(domain).catch(() => [] as string[][]),
  ]);

  let selfTestResult: { ok: boolean; detail: string } | undefined;
  if (sendSelfTest) {
    try {
      await sendSmtpEmail(creds, {
        to: creds.email,
        subject: `Prueba de recepción de buzón (${new Date().toLocaleTimeString('es-PE')})`,
        body: `Este es un correo de prueba enviado automáticamente al propio buzón ${creds.email} a través del servidor ${creds.imapHost} para verificar la recepción local en cPanel.`,
      });
      selfTestResult = {
        ok: true,
        detail: `El servidor SMTP (${creds.imapHost}) aceptó la entrega hacia ${creds.email}. Revise su Bandeja de entrada en unos segundos.`,
      };
    } catch (err) {
      selfTestResult = {
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const mailboxState = await fetchImapMailboxState(creds, 'INBOX', 50, true).catch(() => null);

  const spfRecord =
    txtRecords
      .map((chunks) => chunks.join(''))
      .find((txt) => txt.toLowerCase().startsWith('v=spf1')) || null;

  // Compare MX IP vs connected IMAP server IP
  const cpanelIp = connectedHostIps[0] || creds.imapHost;
  const mxPointingToCpanel = dnsDiag.mxRecords.some((mx) =>
    mx.ips.includes(cpanelIp),
  );

  return NextResponse.json({
    email: creds.email,
    domain,
    nameServers: dnsDiag.nameServers,
    connectedImapServer: `${creds.imapHost}:${creds.imapPort}`,
    connectedImapIp: cpanelIp,
    rootDomainIps: rootIps,
    mailSubdomainIps,
    mxRecords: dnsDiag.mxRecords,
    spfRecord,
    mxPointingToCpanel,
    warning: dnsDiag.warning,
    foldersSummary: mailboxState?.folders.map((f) => ({
      path: f.path,
      total: f.total ?? 0,
      unseen: f.unseen ?? 0,
    })),
    selfTestResult,
  });
}
