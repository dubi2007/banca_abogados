import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';

export type WebmailCredentials = {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
};

export type ImapFolder = {
  path: string;
  name: string;
  specialUse?: 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk';
  total?: number;
  unseen?: number;
};

export type DnsMailDiagnostic = {
  domain: string;
  nameServers: string[];
  mxRecords: { exchange: string; priority: number; ips: string[]; isCloudflareProxy: boolean }[];
  hasValidMx: boolean;
  warning?: string;
};

export type ImapMessageSummary = {
  uid: number;
  seq: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  size: number;
};

export type ImapAttachment = {
  filename: string;
  contentType: string;
  size: number;
  contentBase64: string;
};

export type ImapMessageDetail = {
  uid: number;
  folder?: string;
  isOutgoing?: boolean;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  messageId: string;
  html: string;
  text: string;
  attachments: ImapAttachment[];
};

export const WEBMAIL_COOKIE = 'faynshteyn_wm_session';

function getSecretKey(): Buffer {
  const secret =
    process.env.WEBMAIL_SESSION_SECRET ||
    'faynshteyn-abogados-cpanel-webmail-secret-key-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptWebmailSession(creds: WebmailCredentials): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSecretKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(creds), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptWebmailSession(token: string | undefined): WebmailCredentials | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const encrypted = Buffer.from(parts[2], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getSecretKey(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(json) as WebmailCredentials;
    if (!parsed.email || !parsed.password || !parsed.imapHost) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function resolveDefaultMailHosts() {
  const defaultHost = '198.58.106.39';
  return {
    imapHost: process.env.WEBMAIL_IMAP_HOST || defaultHost,
    imapPort: Number(process.env.WEBMAIL_IMAP_PORT || 993),
    smtpHost: process.env.WEBMAIL_SMTP_HOST || defaultHost,
    smtpPort: Number(process.env.WEBMAIL_SMTP_PORT || 465),
  };
}

function escapeImapString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function decodeMimeWords(input: string): string {
  if (!input) return '';
  const cleaned = input.replace(/\?=[\t ]+=\?/g, '?==?');
  return cleaned.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charsetRaw, encoding, text) => {
    const charset = String(charsetRaw).toLowerCase();
    const enc = String(encoding).toUpperCase();
    try {
      let buf: Buffer;
      if (enc === 'B') {
        buf = Buffer.from(text, 'base64');
      } else {
        const qp = String(text)
          .replace(/_/g, ' ')
          .replace(/=([0-9A-Fa-f]{2})/g, (__, hex) => String.fromCharCode(parseInt(hex, 16)));
        buf = Buffer.from(qp, 'binary');
      }
      if (charset.includes('iso-8859-1') || charset.includes('latin1') || charset.includes('windows-1252')) {
        return buf.toString('latin1');
      }
      return buf.toString('utf8');
    } catch {
      return text;
    }
  });
}

function decodeBodyBuffer(raw: string, transferEncoding: string, charset: string): Buffer {
  const enc = transferEncoding.toLowerCase().trim();
  if (enc === 'base64') {
    return Buffer.from(raw.replace(/\s+/g, ''), 'base64');
  }
  if (enc === 'quoted-printable') {
    const softStripped = raw.replace(/=\r?\n/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < softStripped.length; i++) {
      if (softStripped[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(softStripped.slice(i + 1, i + 3))) {
        bytes.push(parseInt(softStripped.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(softStripped.charCodeAt(i) & 0xff);
      }
    }
    return Buffer.from(bytes);
  }
  void charset;
  return Buffer.from(raw, 'latin1');
}

function bufferToCharsetString(buf: Buffer, charset: string): string {
  const cs = charset.toLowerCase();
  if (cs.includes('iso-8859-1') || cs.includes('latin1') || cs.includes('windows-1252')) {
    return buf.toString('latin1');
  }
  return buf.toString('utf8');
}

function parseHeaders(headerBlock: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = headerBlock.split(/\r?\n/);
  let currentKey = '';
  for (const line of lines) {
    if (/^[\t ]/.test(line) && currentKey) {
      headers[currentKey] += ' ' + line.trim();
    } else {
      const idx = line.indexOf(':');
      if (idx > 0) {
        currentKey = line.slice(0, idx).trim().toLowerCase();
        const val = line.slice(idx + 1).trim();
        headers[currentKey] = headers[currentKey] ? `${headers[currentKey]}, ${val}` : val;
      }
    }
  }
  return headers;
}

export function parseRawMimeMessage(rawMessage: string, uid: number): ImapMessageDetail {
  const splitMatch = rawMessage.match(/\r?\n\r?\n/);
  const headerEndIdx = splitMatch?.index ?? rawMessage.length;
  const sepLen = splitMatch?.[0].length ?? 0;
  const headerBlock = rawMessage.slice(0, headerEndIdx);
  const bodyBlock = rawMessage.slice(headerEndIdx + sepLen);
  const headers = parseHeaders(headerBlock);

  const subject = decodeMimeWords(headers['subject'] || '(Sin asunto)');
  const from = decodeMimeWords(headers['from'] || '');
  const to = decodeMimeWords(headers['to'] || '');
  const cc = decodeMimeWords(headers['cc'] || '');
  const date = headers['date'] || '';
  const messageId = headers['message-id'] || '';

  let htmlParts: string[] = [];
  let textParts: string[] = [];
  const attachments: ImapAttachment[] = [];

  function walkPart(partHeaderRaw: string, partBody: string, isRoot = false) {
    const partHeaders = isRoot ? headers : parseHeaders(partHeaderRaw);
    const contentTypeFull = partHeaders['content-type'] || 'text/plain; charset=utf-8';
    const contentDisposition = partHeaders['content-disposition'] || '';
    const transferEncoding = partHeaders['content-transfer-encoding'] || '7bit';

    const mimeType = contentTypeFull.split(';')[0].trim().toLowerCase();
    const charsetMatch = contentTypeFull.match(/charset=["']?([^"';\s]+)["']?/i);
    const charset = charsetMatch ? charsetMatch[1] : 'utf-8';

    if (mimeType.startsWith('multipart/')) {
      const boundaryMatch = contentTypeFull.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
      const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : '';
      if (boundary) {
        const delim = `--${boundary}`;
        const segments = partBody.split(delim);
        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];
          if (seg.startsWith('--')) break;
          const trimmedSeg = seg.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
          const subSplit = trimmedSeg.match(/\r?\n\r?\n/);
          if (subSplit && subSplit.index !== undefined) {
            const subHead = trimmedSeg.slice(0, subSplit.index);
            const subBody = trimmedSeg.slice(subSplit.index + subSplit[0].length);
            walkPart(subHead, subBody, false);
          }
        }
        return;
      }
    }

    const filenameMatch =
      contentDisposition.match(/filename\*?=["']?([^"';\r\n]+)["']?/i) ||
      contentTypeFull.match(/name=["']?([^"';\r\n]+)["']?/i);

    const isAttachment =
      /attachment/i.test(contentDisposition) ||
      (filenameMatch && !mimeType.startsWith('text/'));

    const decodedBuf = decodeBodyBuffer(partBody, transferEncoding, charset);

    if (isAttachment || (filenameMatch && mimeType !== 'text/plain' && mimeType !== 'text/html')) {
      const rawName = filenameMatch ? filenameMatch[1].replace(/^UTF-8''/i, '') : 'adjunto';
      let filename = decodeMimeWords(rawName);
      try {
        filename = decodeURIComponent(filename);
      } catch {
        // Keep decoded name as-is
      }
      attachments.push({
        filename,
        contentType: mimeType,
        size: decodedBuf.length,
        contentBase64: decodedBuf.toString('base64'),
      });
      return;
    }

    if (mimeType === 'text/html') {
      htmlParts.push(bufferToCharsetString(decodedBuf, charset));
    } else if (mimeType === 'text/plain') {
      textParts.push(bufferToCharsetString(decodedBuf, charset));
    }
  }

  walkPart(headerBlock, bodyBlock, true);

  const text = textParts.join('\n').trim();
  const html = htmlParts.join('\n').trim();

  return {
    uid,
    subject,
    from,
    to,
    cc,
    date,
    messageId,
    html,
    text,
    attachments,
  };
}

class NativeImapConnection {
  private socket: tls.TLSSocket | net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private tagCounter = 1;
  private pendingResolve: ((response: string) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  private pendingTag: string | null = null;
  private pendingContinuationPayload: Buffer | null = null;
  private greetingResolved = false;

  async connect(host: string, port: number, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.destroy();
        reject(new Error(`Tiempo de espera agotado conectando a ${host}:${port}`));
      }, timeoutMs);

      const onConnectError = (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      };

      const useTls = port === 993 || port === 995 || port === 465;
      this.socket = useTls
        ? tls.connect({ host, port, rejectUnauthorized: false })
        : net.connect({ host, port });

      this.socket.on('error', (err) => {
        if (!this.greetingResolved) {
          onConnectError(err);
        } else if (this.pendingReject) {
          const rej = this.pendingReject;
          this.clearPending();
          rej(err);
        }
      });

      this.socket.on('data', (chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        if (!this.greetingResolved) {
          const str = this.buffer.toString('latin1');
          const nlIdx = str.indexOf('\r\n');
          if (nlIdx !== -1) {
            const line = str.slice(0, nlIdx);
            this.buffer = this.buffer.subarray(nlIdx + 2);
            this.greetingResolved = true;
            clearTimeout(timeout);
            if (line.startsWith('* OK')) {
              resolve();
            } else {
              reject(new Error(`Respuesta IMAP inesperada: ${line}`));
            }
          }
          return;
        }
        this.checkPendingResponse();
      });
    });
  }

  private clearPending() {
    this.pendingResolve = null;
    this.pendingReject = null;
    this.pendingTag = null;
    this.pendingContinuationPayload = null;
  }

  private checkPendingResponse() {
    if (!this.pendingTag || !this.pendingResolve) return;
    const text = this.buffer.toString('latin1');

    if (this.pendingContinuationPayload && /(^|\r\n)\+ [^\r\n]*\r\n/.test(text)) {
      const payload = this.pendingContinuationPayload;
      this.pendingContinuationPayload = null;
      this.socket?.write(payload);
      this.socket?.write('\r\n');
    }

    const tagPrefix = `${this.pendingTag} `;
    let searchFrom = 0;

    while (true) {
      const idx = text.indexOf(tagPrefix, searchFrom);
      if (idx === -1) return;
      if (idx === 0 || text[idx - 1] === '\n') {
        const lineEnd = text.indexOf('\r\n', idx);
        if (lineEnd !== -1) {
          const fullResponse = text.slice(0, lineEnd + 2);
          const statusLine = text.slice(idx + tagPrefix.length, lineEnd);
          this.buffer = this.buffer.subarray(lineEnd + 2);
          const res = this.pendingResolve;
          const rej = this.pendingReject;
          this.clearPending();
          if (statusLine.startsWith('OK')) {
            res(fullResponse);
          } else {
            rej?.(new Error(statusLine));
          }
          return;
        }
      }
      searchFrom = idx + 1;
    }
  }

  async command(cmd: string): Promise<string> {
    if (!this.socket) throw new Error('Conexión IMAP cerrada');
    const tag = `A${String(this.tagCounter++).padStart(4, '0')}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingTag === tag) {
          this.clearPending();
          reject(new Error('Tiempo de espera IMAP agotado'));
        }
      }, 15000);

      this.pendingTag = tag;
      this.pendingResolve = (output) => {
        clearTimeout(timer);
        resolve(output);
      };
      this.pendingReject = (err) => {
        clearTimeout(timer);
        reject(err);
      };
      this.socket!.write(`${tag} ${cmd}\r\n`);
    });
  }

  async append(folder: string, flags: string, rawMime: string): Promise<string> {
    if (!this.socket) throw new Error('Conexión IMAP cerrada');
    const payloadBuf = Buffer.from(rawMime, 'utf8');
    const tag = `A${String(this.tagCounter++).padStart(4, '0')}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingTag === tag) {
          this.clearPending();
          reject(new Error('Tiempo de espera APPEND agotado'));
        }
      }, 15000);

      this.pendingTag = tag;
      this.pendingContinuationPayload = payloadBuf;
      this.pendingResolve = (output) => {
        clearTimeout(timer);
        resolve(output);
      };
      this.pendingReject = (err) => {
        clearTimeout(timer);
        reject(err);
      };
      this.socket!.write(
        `${tag} APPEND ${escapeImapString(folder)} (${flags}) {${payloadBuf.length}}\r\n`,
      );
    });
  }

  destroy() {
    try {
      this.socket?.destroy();
    } catch {
      // Ignore socket close errors
    }
    this.socket = null;
  }
}

async function withImap<T>(
  creds: WebmailCredentials,
  fn: (imap: NativeImapConnection) => Promise<T>,
): Promise<T> {
  const imap = new NativeImapConnection();
  try {
    await imap.connect(creds.imapHost, creds.imapPort);
    await imap.command(`LOGIN ${escapeImapString(creds.email)} ${escapeImapString(creds.password)}`);
    const result = await fn(imap);
    await imap.command('LOGOUT').catch(() => null);
    return result;
  } finally {
    imap.destroy();
  }
}

export async function verifyImapLogin(creds: WebmailCredentials): Promise<void> {
  await withImap(creds, async () => true);
}

function classifyFolder(path: string, attrs: string): ImapFolder['specialUse'] {
  const lower = path.toLowerCase();
  const attrLower = attrs.toLowerCase();
  if (lower === 'inbox') return 'inbox';
  if (attrLower.includes('\\sent') || /(^|[./])(sent|enviados|sent items|sent messages)$/i.test(lower)) return 'sent';
  if (attrLower.includes('\\drafts') || /(^|[./])(drafts|borradores)$/i.test(lower)) return 'drafts';
  if (attrLower.includes('\\trash') || /(^|[./])(trash|papelera|deleted|deleted items)$/i.test(lower)) return 'trash';
  if (attrLower.includes('\\junk') || /(^|[./])(junk|spam|correo no deseado)$/i.test(lower)) return 'junk';
  return undefined;
}

function isCloudflareIp(ip: string): boolean {
  return (
    ip.startsWith('104.16.') ||
    ip.startsWith('104.17.') ||
    ip.startsWith('104.18.') ||
    ip.startsWith('104.19.') ||
    ip.startsWith('104.20.') ||
    ip.startsWith('104.21.') ||
    ip.startsWith('104.22.') ||
    ip.startsWith('104.24.') ||
    ip.startsWith('104.25.') ||
    ip.startsWith('104.26.') ||
    ip.startsWith('104.27.') ||
    ip.startsWith('172.64.') ||
    ip.startsWith('172.65.') ||
    ip.startsWith('172.66.') ||
    ip.startsWith('172.67.') ||
    ip.startsWith('188.114.')
  );
}

export async function diagnoseDomainEmailDns(email: string): Promise<DnsMailDiagnostic> {
  const domain = email.includes('@')
    ? email.split('@')[1].trim().toLowerCase()
    : 'faynshteynjuridico.com';

  // Query the authoritative cPanel DNS server (198.58.106.39 / ns1.ihost1001.com) directly first to avoid 14400s TTL cache
  const resolver = new dns.Resolver();
  try {
    resolver.setServers(['198.58.106.39', '1.1.1.1', '8.8.8.8']);
  } catch {
    // Fallback to default system resolver if restricted
  }

  const resolveMxFresh = (d: string) =>
    resolver.resolveMx(d).catch(() => dns.resolveMx(d).catch(() => []));
  const resolve4Fresh = (h: string) =>
    resolver.resolve4(h).catch(() => dns.resolve4(h).catch(() => []));
  const resolveNsFresh = (d: string) =>
    resolver.resolveNs(d).catch(() => dns.resolveNs(d).catch(() => []));

  try {
    const [mxList, nameServers] = await Promise.all([
      resolveMxFresh(domain),
      resolveNsFresh(domain),
    ]);
    mxList.sort((a, b) => a.priority - b.priority);

    const mxRecords: DnsMailDiagnostic['mxRecords'] = [];
    for (const mx of mxList) {
      const cleanHost = mx.exchange.replace(/\.$/, '');
      const ips = await resolve4Fresh(cleanHost);
      const cf = ips.some(isCloudflareIp);
      mxRecords.push({
        exchange: cleanHost,
        priority: mx.priority,
        ips,
        isCloudflareProxy: cf,
      });
    }

    if (mxRecords.length === 0) {
      return {
        domain,
        nameServers,
        mxRecords: [],
        hasValidMx: false,
        warning: `El dominio ${domain} no tiene registros MX públicos configurados en el DNS (${nameServers.join(', ') || 'DNS'}).`,
      };
    }

    const vercelMx = mxRecords.find((m) => m.ips.includes('76.76.21.21'));
    if (vercelMx) {
      return {
        domain,
        nameServers,
        mxRecords,
        hasValidMx: false,
        warning: `El registro MX (${vercelMx.exchange}) sigue resolviendo a la IP de Vercel (76.76.21.21) en lugar de la IP de tu cPanel (198.58.106.39). En tu panel de DNS (${nameServers.join(', ') || 'Zone Editor'}), apunta el Destino del MX a "cpanel.${domain}" (que ya tiene la IP 198.58.106.39) o cambia el registro A de "${vercelMx.exchange}" a 198.58.106.39.`,
      };
    }

    const proxiedMx = mxRecords.find((m) => m.isCloudflareProxy);
    if (proxiedMx) {
      return {
        domain,
        nameServers,
        mxRecords,
        hasValidMx: false,
        warning: `El registro MX (${proxiedMx.exchange} -> ${proxiedMx.ips.join(', ')}) tiene activado el Proxy de Cloudflare (nube naranja).`,
      };
    }

    return {
      domain,
      nameServers,
      mxRecords,
      hasValidMx: true,
    };
  } catch {
    return {
      domain,
      nameServers: [],
      mxRecords: [],
      hasValidMx: true,
    };
  }
}

export async function fetchImapMailboxState(
  creds: WebmailCredentials,
  requestedFolder = 'INBOX',
  limit = 50,
  includeAllFolderCounts = false,
): Promise<{
  folders: ImapFolder[];
  activeFolder: string;
  total: number;
  unseen: number;
  messages: ImapMessageSummary[];
}> {
  return withImap(creds, async (imap) => {
    const listResp = await imap.command('LIST "" "*"');
    const folders: ImapFolder[] = [];
    const seenPaths = new Set<string>();

    for (const line of listResp.split('\r\n')) {
      const m = line.match(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (?:"([^"]+)"|([^\r\n]+))/i);
      if (!m) continue;
      const attrs = m[1] || '';
      if (/\\Noselect/i.test(attrs)) continue;
      const rawPath = (m[2] || m[3] || '').trim();
      if (!rawPath || seenPaths.has(rawPath)) continue;
      seenPaths.add(rawPath);
      const specialUse = classifyFolder(rawPath, attrs);
      const cleanName = rawPath.replace(/^INBOX[./]/i, '');
      folders.push({
        path: rawPath,
        name: rawPath.toUpperCase() === 'INBOX' ? 'INBOX' : cleanName,
        specialUse,
      });
    }

    if (!folders.some((f) => f.path.toUpperCase() === 'INBOX')) {
      folders.unshift({ path: 'INBOX', name: 'INBOX', specialUse: 'inbox' });
    }

    const orderScore = (f: ImapFolder) => {
      if (f.specialUse === 'inbox') return 0;
      if (f.specialUse === 'sent') return 1;
      if (f.specialUse === 'drafts') return 2;
      if (f.specialUse === 'junk') return 3;
      if (f.specialUse === 'trash') return 4;
      return 5;
    };
    folders.sort((a, b) => orderScore(a) - orderScore(b) || a.name.localeCompare(b.name));

    const activeFolder =
      folders.find((f) => f.path.toLowerCase() === requestedFolder.toLowerCase())?.path ||
      'INBOX';

    if (includeAllFolderCounts) {
      for (const folder of folders) {
        const st = await imap
          .command(`STATUS ${escapeImapString(folder.path)} (MESSAGES UNSEEN)`)
          .catch(() => '');
        const msgMatch = st.match(/MESSAGES (\d+)/i);
        const unsMatch = st.match(/UNSEEN (\d+)/i);
        folder.total = msgMatch ? parseInt(msgMatch[1], 10) : 0;
        folder.unseen = unsMatch ? parseInt(unsMatch[1], 10) : 0;
      }
    } else {
      const st = await imap
        .command(`STATUS ${escapeImapString(activeFolder)} (MESSAGES UNSEEN)`)
        .catch(() => '');
      const msgMatch = st.match(/MESSAGES (\d+)/i);
      const unsMatch = st.match(/UNSEEN (\d+)/i);
      const activeMeta = folders.find((f) => f.path === activeFolder);
      if (activeMeta) {
        activeMeta.total = msgMatch ? parseInt(msgMatch[1], 10) : 0;
        activeMeta.unseen = unsMatch ? parseInt(unsMatch[1], 10) : 0;
      }
    }

    const selectResp = await imap.command(`SELECT ${escapeImapString(activeFolder)}`);
    const existsMatch = selectResp.match(/\* (\d+) EXISTS/i);
    const activeFolderMeta = folders.find((f) => f.path === activeFolder);
    const total = existsMatch
      ? parseInt(existsMatch[1], 10)
      : (activeFolderMeta?.total ?? 0);
    const unseen = activeFolderMeta?.unseen ?? 0;

    if (total === 0) {
      return { folders, activeFolder, total: 0, unseen: 0, messages: [] };
    }

    const startSeq = Math.max(1, total - limit + 1);
    const fetchResp = await imap.command(
      `FETCH ${startSeq}:${total} (UID FLAGS RFC822.SIZE INTERNALDATE BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO DATE)])`,
    );

    const messages: ImapMessageSummary[] = [];
    const chunks = fetchResp.split(/(?=\* \d+ FETCH \()/);

    for (const chunk of chunks) {
      const headMatch = chunk.match(/^\* (\d+) FETCH \(([\s\S]*)/);
      if (!headMatch) continue;
      const seq = parseInt(headMatch[1], 10);
      const body = headMatch[2];

      const uidMatch = body.match(/UID (\d+)/i);
      const uid = uidMatch ? parseInt(uidMatch[1], 10) : seq;

      const flagsMatch = body.match(/FLAGS \(([^)]*)\)/i);
      const flagsStr = flagsMatch ? flagsMatch[1] : '';
      if (/\\Deleted/i.test(flagsStr)) continue;

      const seen = /\\Seen/i.test(flagsStr);
      const flagged = /\\Flagged/i.test(flagsStr);
      const answered = /\\Answered/i.test(flagsStr);

      const sizeMatch = body.match(/RFC822\.SIZE (\d+)/i);
      const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;

      const internalDateMatch = body.match(/INTERNALDATE "([^"]+)"/i);
      const fallbackDate = internalDateMatch ? internalDateMatch[1] : '';

      const literalMatch = body.match(/BODY\[[^\]]*\]\s*\{(\d+)\}\r\n([\s\S]*)/i);
      let headerRaw = '';
      if (literalMatch) {
        const byteLen = parseInt(literalMatch[1], 10);
        headerRaw = Buffer.from(literalMatch[2], 'latin1')
          .subarray(0, byteLen)
          .toString('utf8');
      }

      const headers = parseHeaders(headerRaw);
      const subject = decodeMimeWords(headers['subject'] || '(Sin asunto)');
      const from = decodeMimeWords(headers['from'] || '');
      const to = decodeMimeWords(headers['to'] || '');
      const date = headers['date'] || fallbackDate;

      messages.push({
        uid,
        seq,
        subject,
        from,
        to,
        date,
        seen,
        flagged,
        answered,
        size,
      });
    }

    messages.sort((a, b) => b.uid - a.uid);

    return {
      folders,
      activeFolder,
      total,
      unseen,
      messages,
    };
  });
}

export function normalizeSubject(subject: string): string {
  return (subject || '')
    .replace(/^(?:\s*(?:Re|RE|Fwd|FW|RV|Resp)\s*(?:\[\d+\])?\s*:\s*)+/i, '')
    .trim()
    .toLowerCase();
}

export async function fetchImapMessageDetail(
  creds: WebmailCredentials,
  folder: string,
  uid: number,
): Promise<{ message: ImapMessageDetail; thread: ImapMessageDetail[] }> {
  return withImap(creds, async (imap) => {
    await imap.command(`SELECT ${escapeImapString(folder)}`);
    const resp = await imap.command(`UID FETCH ${uid} (UID FLAGS BODY.PEEK[])`);
    const literalMatch = resp.match(/BODY\[\] \{(\d+)\}\r\n([\s\S]*)/i);
    if (!literalMatch) {
      throw new Error('No se encontró el contenido del mensaje.');
    }
    const byteLen = parseInt(literalMatch[1], 10);
    const rawMime = Buffer.from(literalMatch[2], 'latin1').subarray(0, byteLen).toString('latin1');
    await imap.command(`UID STORE ${uid} +FLAGS (\\Seen)`).catch(() => null);
    const mainMessage = parseRawMimeMessage(rawMime, uid);
    mainMessage.folder = folder;
    mainMessage.isOutgoing = mainMessage.from.toLowerCase().includes(creds.email.toLowerCase());

    const baseSubject = normalizeSubject(mainMessage.subject);
    if (!baseSubject || baseSubject === '(sin asunto)') {
      return { message: mainMessage, thread: [mainMessage] };
    }

    // Gather related messages from INBOX and Sent folder to build the full conversation thread
    const threadMessages: ImapMessageDetail[] = [];
    const seenMessageKeys = new Set<string>();
    const foldersToScan = Array.from(new Set([folder, 'INBOX', 'INBOX.Sent', 'Sent']));

    for (const scanFolder of foldersToScan) {
      try {
        const sel = await imap.command(`SELECT ${escapeImapString(scanFolder)}`);
        const exMatch = sel.match(/\* (\d+) EXISTS/i);
        const count = exMatch ? parseInt(exMatch[1], 10) : 0;
        if (count === 0) continue;

        const start = Math.max(1, count - 30 + 1);
        const hdrResp = await imap.command(
          `FETCH ${start}:${count} (UID FLAGS BODY.PEEK[HEADER.FIELDS (SUBJECT MESSAGE-ID)])`,
        );

        const matchingUids: number[] = [];
        const chunks = hdrResp.split(/(?=\* \d+ FETCH \()/);
        for (const chunk of chunks) {
          const headMatch = chunk.match(/^\* (\d+) FETCH \(([\s\S]*)/);
          if (!headMatch) continue;
          const body = headMatch[2];
          if (/\\Deleted/i.test(body)) continue;
          const uMatch = body.match(/UID (\d+)/i);
          const candidateUid = uMatch ? parseInt(uMatch[1], 10) : 0;
          if (!candidateUid) continue;

          const lit = body.match(/BODY\[[^\]]*\]\s*\{(\d+)\}\r\n([\s\S]*)/i);
          if (!lit) continue;
          const len = parseInt(lit[1], 10);
          const hRaw = Buffer.from(lit[2], 'latin1').subarray(0, len).toString('utf8');
          const hdrs = parseHeaders(hRaw);
          const subj = decodeMimeWords(hdrs['subject'] || '');
          if (normalizeSubject(subj) === baseSubject) {
            matchingUids.push(candidateUid);
          }
        }

        for (const mUid of matchingUids) {
          if (scanFolder === folder && mUid === uid) {
            const key = mainMessage.messageId || `${scanFolder}:${mUid}`;
            if (!seenMessageKeys.has(key)) {
              seenMessageKeys.add(key);
              threadMessages.push(mainMessage);
            }
            continue;
          }
          const fullResp = await imap
            .command(`UID FETCH ${mUid} (UID FLAGS BODY.PEEK[])`)
            .catch(() => '');
          const fLit = fullResp.match(/BODY\[\] \{(\d+)\}\r\n([\s\S]*)/i);
          if (!fLit) continue;
          const fLen = parseInt(fLit[1], 10);
          const fMime = Buffer.from(fLit[2], 'latin1').subarray(0, fLen).toString('latin1');
          const parsed = parseRawMimeMessage(fMime, mUid);
          parsed.folder = scanFolder;
          parsed.isOutgoing =
            /sent|enviados/i.test(scanFolder) ||
            parsed.from.toLowerCase().includes(creds.email.toLowerCase());
          const key = parsed.messageId || `${scanFolder}:${mUid}`;
          if (!seenMessageKeys.has(key)) {
            seenMessageKeys.add(key);
            threadMessages.push(parsed);
          }
        }
      } catch {
        // Folder may not exist; continue
      }
    }

    if (threadMessages.length === 0) {
      threadMessages.push(mainMessage);
    }

    threadMessages.sort((a, b) => {
      const ta = new Date(a.date).getTime() || 0;
      const tb = new Date(b.date).getTime() || 0;
      return ta - tb;
    });

    return {
      message: threadMessages[threadMessages.length - 1] || mainMessage,
      thread: threadMessages,
    };
  });
}

export async function updateImapMessageSeen(
  creds: WebmailCredentials,
  folder: string,
  uid: number,
  seen: boolean,
): Promise<void> {
  await withImap(creds, async (imap) => {
    await imap.command(`SELECT ${escapeImapString(folder)}`);
    const op = seen ? '+FLAGS' : '-FLAGS';
    await imap.command(`UID STORE ${uid} ${op} (\\Seen)`);
  });
}

export async function updateImapMessageFlagged(
  creds: WebmailCredentials,
  folder: string,
  uid: number,
  flagged: boolean,
): Promise<void> {
  await withImap(creds, async (imap) => {
    await imap.command(`SELECT ${escapeImapString(folder)}`);
    const op = flagged ? '+FLAGS' : '-FLAGS';
    await imap.command(`UID STORE ${uid} ${op} (\\Flagged)`);
  });
}

export async function moveImapMessage(
  creds: WebmailCredentials,
  sourceFolder: string,
  targetFolder: string,
  uid: number,
): Promise<void> {
  await withImap(creds, async (imap) => {
    await imap.command(`SELECT ${escapeImapString(sourceFolder)}`);
    await imap.command(`UID COPY ${uid} ${escapeImapString(targetFolder)}`);
    await imap.command(`UID STORE ${uid} +FLAGS (\\Deleted)`);
    await imap.command('EXPUNGE');
  });
}

export async function deleteImapMessage(
  creds: WebmailCredentials,
  folder: string,
  uid: number,
): Promise<void> {
  await withImap(creds, async (imap) => {
    await imap.command(`SELECT ${escapeImapString(folder)}`);
    await imap.command(`UID STORE ${uid} +FLAGS (\\Deleted)`);
    await imap.command('EXPUNGE');
  });
}

export type OutgoingAttachment = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

export type OutgoingEmailPayload = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  inReplyTo?: string;
  attachments?: OutgoingAttachment[];
};

function chunkBase64(b64: string): string {
  const clean = b64.replace(/\s+/g, '');
  const lines: string[] = [];
  for (let i = 0; i < clean.length; i += 76) {
    lines.push(clean.slice(i, i + 76));
  }
  return lines.join('\r\n');
}

function buildMimeMessage(creds: WebmailCredentials, payload: OutgoingEmailPayload): string {
  const altBoundary = `----=_Alt_${crypto.randomBytes(8).toString('hex')}`;
  const mixedBoundary = `----=_Mix_${crypto.randomBytes(8).toString('hex')}`;
  const subjEncoded = `=?UTF-8?B?${Buffer.from(payload.subject || '(Sin asunto)', 'utf8').toString('base64')}?=`;
  const msgId = `<${crypto.randomUUID()}@${creds.email.split('@')[1] || 'faynshteynjuridico.com'}>`;
  const nowUtc = new Date().toUTCString();

  const fallbackHtml = (payload.body || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br/>');

  const finalHtml = payload.htmlBody?.trim()
    ? `<div style="font-family: Georgia, serif; font-size: 15px; line-height: 1.6; color: #181b1f;">${payload.htmlBody}</div>`
    : `<div style="font-family: Georgia, serif; font-size: 15px; line-height: 1.6; color: #181b1f;">${fallbackHtml}</div>`;

  const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0;

  const headers = [
    `From: <${creds.email}>`,
    `Reply-To: <${creds.email}>`,
    `To: ${payload.to || ''}`,
    ...(payload.cc ? [`Cc: ${payload.cc}`] : []),
    `Subject: ${subjEncoded}`,
    `Date: ${nowUtc}`,
    `Message-ID: ${msgId}`,
    ...(payload.inReplyTo ? [`In-Reply-To: ${payload.inReplyTo}`, `References: ${payload.inReplyTo}`] : []),
    'MIME-Version: 1.0',
  ];

  const altPartLines = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    chunkBase64(Buffer.from(payload.body || '', 'utf8').toString('base64')),
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    chunkBase64(Buffer.from(finalHtml, 'utf8').toString('base64')),
    '',
    `--${altBoundary}--`,
  ];

  if (!hasAttachments) {
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      ...altPartLines,
      '',
    ].join('\r\n');
  }

  const attachmentLines: string[] = [];
  for (const att of payload.attachments!) {
    const encodedFilename = `=?UTF-8?B?${Buffer.from(att.filename, 'utf8').toString('base64')}?=`;
    const cType = att.contentType || 'application/octet-stream';
    attachmentLines.push(
      `--${mixedBoundary}`,
      `Content-Type: ${cType}; name="${encodedFilename}"`,
      `Content-Disposition: attachment; filename="${encodedFilename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      chunkBase64(att.contentBase64),
      '',
    );
  }

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    ...altPartLines,
    '',
    ...attachmentLines,
    `--${mixedBoundary}--`,
    '',
  ].join('\r\n');
}

export async function saveImapDraft(
  creds: WebmailCredentials,
  payload: OutgoingEmailPayload,
): Promise<void> {
  const rawMime = buildMimeMessage(creds, payload);
  await withImap(creds, async (imap) => {
    let saved = false;
    for (const candidate of ['INBOX.Drafts', 'Drafts', 'INBOX.Borradores', 'Borradores']) {
      try {
        await imap.command(`SELECT ${escapeImapString(candidate)}`);
        await imap.append(candidate, '\\Seen \\Draft', rawMime);
        saved = true;
        break;
      } catch {
        // Try next Drafts folder name
      }
    }
    if (!saved) {
      await imap.append('INBOX', '\\Seen \\Draft', rawMime);
    }
  });
}

export async function sendSmtpEmail(
  creds: WebmailCredentials,
  payload: OutgoingEmailPayload,
): Promise<void> {
  const recipients = [
    ...payload.to.split(','),
    ...(payload.cc ? payload.cc.split(',') : []),
    ...(payload.bcc ? payload.bcc.split(',') : []),
  ]
    .map((addr) => {
      const m = addr.match(/<([^>]+)>/);
      return (m ? m[1] : addr).trim();
    })
    .filter(Boolean);

  if (recipients.length === 0) {
    throw new Error('Debe especificar al menos un destinatario válido.');
  }

  const rawMime = buildMimeMessage(creds, payload);
  const domain = creds.email.split('@')[1] || 'localhost';
  const authPlain = Buffer.from(`\0${creds.email}\0${creds.password}`, 'utf8').toString('base64');

  const attemptSmtpSend = (host: string, port: number, implicitTls: boolean) =>
    new Promise<void>((resolve, reject) => {
      let activeSocket: net.Socket | tls.TLSSocket = implicitTls
        ? tls.connect({ host, port, servername: host, rejectUnauthorized: false })
        : net.connect({ host, port });

      let buf = '';
      let state:
        | 'GREETING'
        | 'EHLO_INITIAL'
        | 'STARTTLS'
        | 'EHLO_TLS'
        | 'AUTH_PLAIN'
        | 'AUTH_LOGIN_USER'
        | 'AUTH_LOGIN_PASS'
        | 'MAIL_FROM'
        | 'RCPT_TO'
        | 'DATA_CMD'
        | 'DATA_BODY'
        | 'QUIT' = 'GREETING';

      let rcptIdx = 0;
      let upgradedToTls = implicitTls;

      const timer = setTimeout(() => {
        activeSocket.destroy();
        reject(new Error(`Tiempo de espera agotado conectando a SMTP ${host}:${port}`));
      }, 15000);

      const fail = (err: Error) => {
        clearTimeout(timer);
        activeSocket.destroy();
        reject(err);
      };

      const sendLine = (line: string) => {
        activeSocket.write(`${line}\r\n`);
      };

      const handleResponse = (code: number, fullText: string) => {
        if (state === 'GREETING') {
          if (code >= 400) return fail(new Error(`Error SMTP (${code}): ${fullText}`));
          state = upgradedToTls ? 'EHLO_TLS' : 'EHLO_INITIAL';
          sendLine(`EHLO ${domain}`);
          return;
        }

        if (state === 'EHLO_INITIAL') {
          if (code >= 400) return fail(new Error(`Error SMTP (${code}): ${fullText}`));
          if (/STARTTLS/i.test(fullText)) {
            state = 'STARTTLS';
            sendLine('STARTTLS');
          } else {
            state = 'AUTH_PLAIN';
            sendLine(`AUTH PLAIN ${authPlain}`);
          }
          return;
        }

        if (state === 'STARTTLS') {
          if (code !== 220) return fail(new Error(`Error STARTTLS (${code}): ${fullText}`));
          const plainSocket = activeSocket as net.Socket;
          plainSocket.removeAllListeners('data');
          plainSocket.removeAllListeners('error');
          const tlsSocket = tls.connect(
            { socket: plainSocket, servername: host, rejectUnauthorized: false },
            () => {
              upgradedToTls = true;
              state = 'EHLO_TLS';
              sendLine(`EHLO ${domain}`);
            },
          );
          activeSocket = tlsSocket;
          attachListeners(tlsSocket);
          return;
        }

        if (state === 'EHLO_TLS') {
          if (code >= 400) return fail(new Error(`Error SMTP (${code}): ${fullText}`));
          state = 'AUTH_PLAIN';
          sendLine(`AUTH PLAIN ${authPlain}`);
          return;
        }

        if (state === 'AUTH_PLAIN') {
          if (code === 235) {
            state = 'MAIL_FROM';
            sendLine(`MAIL FROM:<${creds.email}>`);
            return;
          }
          // Fallback to AUTH LOGIN if AUTH PLAIN is not accepted
          state = 'AUTH_LOGIN_USER';
          sendLine('AUTH LOGIN');
          return;
        }

        if (state === 'AUTH_LOGIN_USER') {
          if (code !== 334) return fail(new Error(`Error AUTH LOGIN (${code}): ${fullText}`));
          state = 'AUTH_LOGIN_PASS';
          sendLine(Buffer.from(creds.email, 'utf8').toString('base64'));
          return;
        }

        if (state === 'AUTH_LOGIN_PASS') {
          if (code === 334) {
            sendLine(Buffer.from(creds.password, 'utf8').toString('base64'));
            return;
          }
          if (code === 235) {
            state = 'MAIL_FROM';
            sendLine(`MAIL FROM:<${creds.email}>`);
            return;
          }
          return fail(new Error(`Error de autenticación SMTP (${code}): ${fullText}`));
        }

        if (state === 'MAIL_FROM') {
          if (code >= 400) return fail(new Error(`Error MAIL FROM (${code}): ${fullText}`));
          state = 'RCPT_TO';
          rcptIdx = 0;
          sendLine(`RCPT TO:<${recipients[rcptIdx++]}>`);
          return;
        }

        if (state === 'RCPT_TO') {
          if (code >= 400) return fail(new Error(`Error RCPT TO (${code}): ${fullText}`));
          if (rcptIdx < recipients.length) {
            sendLine(`RCPT TO:<${recipients[rcptIdx++]}>`);
          } else {
            state = 'DATA_CMD';
            sendLine('DATA');
          }
          return;
        }

        if (state === 'DATA_CMD') {
          if (code !== 354) return fail(new Error(`Error DATA (${code}): ${fullText}`));
          state = 'DATA_BODY';
          const dotStuffed = rawMime.replace(/^\./gm, '..');
          sendLine(`${dotStuffed}\r\n.`);
          return;
        }

        if (state === 'DATA_BODY') {
          if (code >= 400) return fail(new Error(`Error enviando cuerpo SMTP (${code}): ${fullText}`));
          state = 'QUIT';
          sendLine('QUIT');
          clearTimeout(timer);
          activeSocket.end();
          resolve();
        }
      };

      let multiLineBuffer: string[] = [];

      const attachListeners = (sock: net.Socket | tls.TLSSocket) => {
        sock.on('error', fail);
        sock.on('data', (chunk: Buffer) => {
          buf += chunk.toString('utf8');
          const lines = buf.split('\r\n');
          buf = lines.pop() || '';

          for (const line of lines) {
            if (/^\d{3}-/.test(line)) {
              multiLineBuffer.push(line);
              continue;
            }
            if (/^\d{3} /.test(line)) {
              multiLineBuffer.push(line);
              const code = parseInt(line.slice(0, 3), 10);
              const fullResponse = multiLineBuffer.join('\n');
              multiLineBuffer = [];
              handleResponse(code, fullResponse);
            }
          }
        });
      };

      attachListeners(activeSocket);
    });

  // Try implicit SSL (465) and STARTTLS (587) automatically
  const candidateTargets: { host: string; port: number; implicitTls: boolean }[] = [
    { host: creds.imapHost, port: 465, implicitTls: true },
    { host: creds.imapHost, port: 587, implicitTls: false },
    { host: creds.smtpHost, port: creds.smtpPort, implicitTls: creds.smtpPort === 465 },
  ];

  let lastSmtpErr: Error | null = null;
  let sent = false;
  const tried = new Set<string>();

  for (const target of candidateTargets) {
    const key = `${target.host}:${target.port}:${target.implicitTls}`;
    if (tried.has(key)) continue;
    tried.add(key);
    try {
      await attemptSmtpSend(target.host, target.port, target.implicitTls);
      sent = true;
      break;
    } catch (err) {
      lastSmtpErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (!sent) {
    throw lastSmtpErr || new Error('No se pudo enviar el correo por SMTP.');
  }

  // Also save a copy in the cPanel IMAP Sent folder (INBOX.Sent or Sent)
  await withImap(creds, async (imap) => {
    for (const candidate of ['INBOX.Sent', 'Sent', 'INBOX.Enviados', 'Enviados']) {
      try {
        await imap.command(`SELECT ${escapeImapString(candidate)}`);
        await imap.append(candidate, '\\Seen', rawMime);
        break;
      } catch {
        // Try next Sent folder naming convention
      }
    }
  }).catch(() => null);
}
