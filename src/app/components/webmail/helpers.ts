import type { Language } from '../../../utils/i18n';
import type { ImapFolder, ImapMessageDetail } from './types';

export function formatDate(raw: string, lang: Language): string {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const now = new Date();
  const sameDay =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate();

  return parsed.toLocaleString(lang === 'en' ? 'en-US' : 'es-PE', {
    ...(sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : {
          day: '2-digit',
          month: 'short',
          year: parsed.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        }),
  });
}

export function formatFullDate(raw: string, lang: Language): string {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString(lang === 'en' ? 'en-US' : 'es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extractSenderName(from: string): { name: string; address: string } {
  if (!from) return { name: '(Desconocido)', address: '' };
  const match = from.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    const cleanName = match[1].replace(/^["']|["']$/g, '').trim();
    return { name: cleanName || match[2], address: match[2].trim() };
  }
  return { name: from.trim(), address: from.trim() };
}

export function extractEmailList(raw: string, excludeEmail?: string): string[] {
  if (!raw) return [];
  const lowerExclude = excludeEmail?.trim().toLowerCase();
  const parts = raw.split(',');
  const result: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const { address } = extractSenderName(part.trim());
    const clean = address.toLowerCase();
    if (!clean || !clean.includes('@')) continue;
    if (lowerExclude && clean === lowerExclude) continue;
    if (!seen.has(clean)) {
      seen.add(clean);
      result.push(address);
    }
  }
  return result;
}

export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function htmlToPlainText(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, '');
  const tmp = document.createElement('div');
  tmp.innerHTML = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>/gi, '\n');
  return (tmp.textContent || tmp.innerText || '').trim();
}

export function getFolderLabel(folder: ImapFolder, english: boolean): string {
  if (folder.specialUse === 'inbox') return english ? 'Inbox' : 'Bandeja de entrada';
  if (folder.specialUse === 'sent') return english ? 'Sent' : 'Enviados';
  if (folder.specialUse === 'drafts') return english ? 'Drafts' : 'Borradores';
  if (folder.specialUse === 'junk') return 'Spam';
  if (folder.specialUse === 'trash') return english ? 'Trash' : 'Papelera';
  return folder.name;
}

export function getCorporateSignatureHtml(sessionEmail: string): string {
  return `
    <br/>
    <div style="margin-top: 18px; padding-top: 12px; border-top: 1px solid #cfaa65; font-family: Georgia, serif; color: #181b1f;">
      <strong style="font-size: 14px; letter-spacing: 0.06em;">FAYNSHTEYN ABOGADOS &amp; CONSULTORES</strong><br/>
      <span style="font-size: 12px; color: #75541f;">${escapeHtml(sessionEmail)}</span><br/>
      <span style="font-size: 12px; color: #4c4e51;">Calle Chinchón 886, San Isidro, Lima - Perú | +51 1 612 3000</span>
    </div>
  `;
}

export function buildQuotedHtml(
  detail: ImapMessageDetail,
  sessionEmail: string,
  lang: Language,
  isForward = false,
): string {
  const english = lang === 'en';
  const signature = getCorporateSignatureHtml(sessionEmail);
  const contentHtml = detail.html
    ? sanitizeEmailHtml(detail.html)
    : `<pre style="font-family: Georgia, serif; white-space: pre-wrap;">${escapeHtml(detail.text || '')}</pre>`;

  if (isForward) {
    return `
      <p><br/></p>
      ${signature}
      <br/>
      <div style="margin-top: 16px; padding: 12px 16px; border-left: 3px solid #cfaa65; background-color: #f5f4f1; font-size: 13px; color: #181b1f;">
        <strong>---------- ${english ? 'Forwarded message' : 'Mensaje reenviado'} ----------</strong><br/>
        <strong>${english ? 'From' : 'De'}:</strong> ${escapeHtml(detail.from)}<br/>
        <strong>${english ? 'Date' : 'Fecha'}:</strong> ${escapeHtml(formatFullDate(detail.date, lang))}<br/>
        <strong>${english ? 'Subject' : 'Asunto'}:</strong> ${escapeHtml(detail.subject)}<br/>
        <strong>${english ? 'To' : 'Para'}:</strong> ${escapeHtml(detail.to)}
        ${detail.cc ? `<br/><strong>CC:</strong> ${escapeHtml(detail.cc)}` : ''}
        <hr style="border: 0; border-top: 1px solid #dedbd4; margin: 10px 0;" />
        <div>${contentHtml}</div>
      </div>
    `;
  }

  return `
    <p><br/></p>
    ${signature}
    <br/>
    <blockquote style="margin: 14px 0 0 0; padding-left: 14px; border-left: 2px solid #cfaa65; color: #4c4e51;">
      <p style="font-size: 12px; margin-bottom: 8px;">
        ${english ? 'On' : 'El'} ${escapeHtml(formatFullDate(detail.date, lang))}, <strong>${escapeHtml(detail.from)}</strong> ${english ? 'wrote:' : 'escribió:'}
      </p>
      <div>${contentHtml}</div>
    </blockquote>
  `;
}

export function printEmailMessage(detail: ImapMessageDetail, lang: Language): void {
  const win = window.open('', '_blank', 'width=850,height=700');
  if (!win) return;
  const bodyHtml = detail.html
    ? sanitizeEmailHtml(detail.html)
    : `<pre style="font-family: Georgia, serif; white-space: pre-wrap;">${escapeHtml(detail.text)}</pre>`;
  win.document.write(`<!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(detail.subject)}</title>
        <style>
          body { font-family: Georgia, serif; color: #181b1f; padding: 32px; line-height: 1.6; }
          .header { border-bottom: 2px solid #cfaa65; padding-bottom: 16px; margin-bottom: 24px; }
          .firm { font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #75541f; }
          h1 { font-size: 22px; margin: 8px 0 12px; }
          .meta { font-size: 13px; color: #4c4e51; margin: 3px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="firm">Faynshteyn Abogados &amp; Consultores</div>
          <h1>${escapeHtml(detail.subject)}</h1>
          <div class="meta"><strong>De:</strong> ${escapeHtml(detail.from)}</div>
          <div class="meta"><strong>Para:</strong> ${escapeHtml(detail.to)}</div>
          ${detail.cc ? `<div class="meta"><strong>CC:</strong> ${escapeHtml(detail.cc)}</div>` : ''}
          <div class="meta"><strong>Fecha:</strong> ${escapeHtml(formatFullDate(detail.date, lang))}</div>
        </div>
        <div>${bodyHtml}</div>
      </body>
    </html>`);
  win.document.close();
  win.focus();
  win.print();
}
