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

  // Check what Google Public DNS (8.8.8.8 - used by Gmail!) currently sees in its cache
  const googleResolver = new dns.Resolver();
  try {
    googleResolver.setServers(['8.8.8.8', '8.8.4.4']);
  } catch {
    // Ignore if restricted
  }

  const [dnsDiag, googleMxList, rootIps, mailSubdomainIps, connectedHostIps, txtRecords] =
    await Promise.all([
      diagnoseDomainEmailDns(creds.email),
      googleResolver.resolveMx(domain).catch(() => [] as { exchange: string; priority: number }[]),
      dns.resolve4(domain).catch(() => [] as string[]),
      dns.resolve4(`mail.${domain}`).catch(() => [] as string[]),
      dns.resolve4(creds.imapHost).catch(() => [creds.imapHost]),
      dns.resolveTxt(domain).catch(() => [] as string[][]),
    ]);

  const googleMxDetails: { exchange: string; priority: number; ips: string[] }[] = [];
  for (const gmx of googleMxList) {
    const cleanHost = gmx.exchange.replace(/\.$/, '');
    const ips = await googleResolver.resolve4(cleanHost).catch(() => [] as string[]);
    googleMxDetails.push({
      exchange: cleanHost,
      priority: gmx.priority,
      ips,
    });
  }

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
    googleMxDetails,
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
