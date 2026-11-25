import dns from 'node:dns/promises';
import net from 'node:net';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  decryptWebmailSession,
  fetchImapMailboxState,
  sendSmtpEmail,
  WEBMAIL_COOKIE,
} from '../../../../utils/webmail';

async function resolveMxWithServer(domain: string, servers: string[]) {
  const resolver = new dns.Resolver();
  try {
    resolver.setServers(servers);
  } catch {
    // Fallback
  }
  const mxList = await resolver.resolveMx(domain).catch(() => [] as { exchange: string; priority: number }[]);
  mxList.sort((a, b) => a.priority - b.priority);
  const results: { exchange: string; priority: number; ips: string[] }[] = [];
  for (const mx of mxList) {
    const cleanHost = mx.exchange.replace(/\.$/, '');
    const ips = await resolver.resolve4(cleanHost).catch(() => [] as string[]);
    results.push({ exchange: cleanHost, priority: mx.priority, ips });
  }
  return results;
}

async function simulateInboundPort25(
  host: string,
  recipientEmail: string,
): Promise<{ reachable: boolean; accepted: boolean; transcript: string }> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: 25 });
    const log: string[] = [];
    let buf = '';
    let step = 0;
    let resolved = false;

    const finish = (reachable: boolean, accepted: boolean) => {
      if (resolved) return;
      resolved = true;
      try {
        socket.destroy();
      } catch {
        // Ignore
      }
      resolve({ reachable, accepted, transcript: log.join('\n') });
    };

    const timer = setTimeout(() => {
      log.push('TIMEOUT esperando respuesta en puerto 25');
      finish(false, false);
    }, 8000);

    socket.on('error', (err) => {
      clearTimeout(timer);
      log.push(`ERROR TCP puerto 25: ${err.message}`);
      finish(false, false);
    });

    const send = (cmd: string) => {
      log.push(`> ${cmd}`);
      socket.write(`${cmd}\r\n`);
    };

    socket.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      const lines = buf.split('\r\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        log.push(`< ${line}`);
        if (!/^\d{3} /.test(line)) continue;
        const code = parseInt(line.slice(0, 3), 10);

        if (step === 0) {
          step = 1;
          send('EHLO mail-tester.google.com');
        } else if (step === 1) {
          step = 2;
          send('MAIL FROM:<remitente.externo@gmail.com>');
        } else if (step === 2) {
          if (code >= 400) {
            clearTimeout(timer);
            finish(true, false);
            return;
          }
          step = 3;
          send(`RCPT TO:<${recipientEmail}>`);
        } else if (step === 3) {
          clearTimeout(timer);
          send('QUIT');
          finish(true, code >= 200 && code < 300);
          return;
        }
      }
    });
  });
}

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

  const [
    cpanelMx,
    googleMx,
    cloudflareMx,
    nameServers,
    rootIps,
    mailSubdomainIps,
    connectedHostIps,
    txtRecords,
    port25Sim,
  ] = await Promise.all([
    resolveMxWithServer(domain, ['198.58.106.39']),
    resolveMxWithServer(domain, ['8.8.8.8', '8.8.4.4']),
    resolveMxWithServer(domain, ['1.1.1.1', '1.0.0.1']),
    dns.resolveNs(domain).catch(() => [] as string[]),
    dns.resolve4(domain).catch(() => [] as string[]),
    dns.resolve4(`mail.${domain}`).catch(() => [] as string[]),
    dns.resolve4(creds.imapHost).catch(() => [creds.imapHost]),
    dns.resolveTxt(domain).catch(() => [] as string[][]),
    simulateInboundPort25('198.58.106.39', creds.email),
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

  const cpanelIp = connectedHostIps[0] || creds.imapHost;

  return NextResponse.json({
    email: creds.email,
    domain,
    nameServers,
    connectedImapServer: `${creds.imapHost}:${creds.imapPort}`,
    connectedImapIp: cpanelIp,
    rootDomainIps: rootIps,
    mailSubdomainIps,
    mxRecords: cpanelMx.map((m) => ({ ...m, isCloudflareProxy: false })),
    googleMxDetails: googleMx,
    cloudflareMxDetails: cloudflareMx,
    port25Sim,
    spfRecord,
    mxPointingToCpanel: googleMx.some((mx) => mx.ips.includes(cpanelIp)),
    foldersSummary: mailboxState?.folders.map((f) => ({
      path: f.path,
      total: f.total ?? 0,
      unseen: f.unseen ?? 0,
    })),
    inboxPreview: mailboxState?.messages.slice(0, 10).map((m) => ({
      uid: m.uid,
      from: m.from,
      subject: m.subject,
      date: m.date,
    })),
    selfTestResult,
  });
}
