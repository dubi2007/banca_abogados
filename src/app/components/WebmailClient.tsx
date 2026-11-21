'use client';

import {
  AlertCircle,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  CheckCircle2,
  ChevronDown,
  Download,
  Eraser,
  ExternalLink,
  Eye,
  EyeOff,
  FileSignature,
  FileText,
  Folder,
  FolderInput,
  Forward,
  Inbox,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MailOpen,
  Paperclip,
  PenSquare,
  Printer,
  Quote,
  RefreshCw,
  Reply,
  ReplyAll,
  Save,
  Search,
  Send,
  Server,
  ShieldAlert,
  Star,
  Strikethrough,
  Trash2,
  Underline,
  Upload,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '../../utils/i18n';
import type {
  DnsMailDiagnostic,
  ImapAttachment,
  ImapFolder,
  ImapMessageDetail,
  ImapMessageSummary,
} from '../../utils/webmail';

type Props = {
  lang: Language;
};

type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';
type FilterTab = 'all' | 'unread' | 'starred';

function formatDate(raw: string, lang: Language): string {
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

function formatFullDate(raw: string, lang: Language): string {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString(lang === 'en' ? 'en-US' : 'es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractSenderName(from: string): { name: string; address: string } {
  if (!from) return { name: '(Desconocido)', address: '' };
  const match = from.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    const cleanName = match[1].replace(/^["']|["']$/g, '').trim();
    return { name: cleanName || match[2], address: match[2].trim() };
  }
  return { name: from.trim(), address: from.trim() };
}

function extractEmailList(raw: string, excludeEmail?: string): string[] {
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

function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function htmlToPlainText(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, '');
  const tmp = document.createElement('div');
  tmp.innerHTML = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>|<\/div>|<\/li>/gi, '\n');
  return (tmp.textContent || tmp.innerText || '').trim();
}

export default function WebmailClient({ lang }: Props) {
  const english = lang === 'en';

  // Session state
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionEmail, setSessionEmail] = useState('');
  const [sessionHost, setSessionHost] = useState('');

  // Login form state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imapHostInput, setImapHostInput] = useState('mail.faynshteynjuridico.com');
  const [imapPortInput, setImapPortInput] = useState('993');
  const [smtpHostInput, setSmtpHostInput] = useState('mail.faynshteynjuridico.com');
  const [smtpPortInput, setSmtpPortInput] = useState('465');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Inbox state
  const [folders, setFolders] = useState<ImapFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState('INBOX');
  const [messages, setMessages] = useState<ImapMessageSummary[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMailbox, setLoadingMailbox] = useState(false);
  const [mailboxError, setMailboxError] = useState('');
  const [dnsDiagnostic, setDnsDiagnostic] = useState<DnsMailDiagnostic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  // Active message reader state
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ImapMessageDetail | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);

  // Diagnostics modal state
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagData, setDiagData] = useState<{
    email: string;
    domain: string;
    nameServers?: string[];
    connectedImapServer: string;
    connectedImapIp: string;
    rootDomainIps: string[];
    mailSubdomainIps: string[];
    mxRecords: { exchange: string; priority: number; ips: string[]; isCloudflareProxy: boolean }[];
    spfRecord: string | null;
    mxPointingToCpanel: boolean;
    warning?: string;
    foldersSummary?: { path: string; total: number; unseen: number }[];
    selfTestResult?: { ok: boolean; detail: string };
  } | null>(null);

  // Compose & Rich Text Editor state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>('new');
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<ImapAttachment[]>([]);
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | undefined>(undefined);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [composeNotice, setComposeNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEmailChange = (val: string) => {
    setEmailInput(val);
    if (val.includes('@')) {
      const domain = val.split('@')[1]?.trim().toLowerCase();
      if (domain && domain.includes('.')) {
        setImapHostInput(`mail.${domain}`);
        setSmtpHostInput(`mail.${domain}`);
      }
    }
  };

  const loadFolder = useCallback(
    async (folderPath: string, preserveSelection = false) => {
      setLoadingMailbox(true);
      setMailboxError('');
      if (!preserveSelection) {
        setSelectedUid(null);
        setSelectedMessage(null);
      }
      try {
        const res = await fetch(
          `/api/webmail/messages?folder=${encodeURIComponent(folderPath)}`,
          { cache: 'no-store' },
        );
        const data = await res.json();
        if (res.status === 401) {
          setAuthenticated(false);
          return;
        }
        if (!res.ok) {
          setMailboxError(data.error || 'Error cargando bandeja IMAP');
          return;
        }
        setFolders(data.folders || []);
        setActiveFolder(data.activeFolder || folderPath);
        setMessages(data.messages || []);
        setUnseenCount(data.unseen ?? 0);
        setTotalCount(data.total ?? 0);
        if (data.dnsDiagnostic) {
          setDnsDiagnostic(data.dnsDiagnostic);
        }
      } catch {
        setMailboxError(
          english
            ? 'Could not connect to the IMAP server.'
            : 'No se pudo conectar con el servidor IMAP.',
        );
      } finally {
        setLoadingMailbox(false);
      }
    },
    [english],
  );

  useEffect(() => {
    let active = true;
    fetch('/api/webmail/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data?.authenticated) {
          setAuthenticated(true);
          setSessionEmail(data.email || '');
          setSessionHost(data.imapHost || '');
          loadFolder('INBOX');
        }
      })
      .catch(() => null)
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [loadFolder]);

  // Background auto-sync every 8 seconds so incoming emails appear quickly
  useEffect(() => {
    if (!authenticated) return;
    const interval = window.setInterval(() => {
      fetch(`/api/webmail/messages?folder=${encodeURIComponent(activeFolder)}`, {
        cache: 'no-store',
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setFolders(data.folders || []);
          setMessages(data.messages || []);
          setUnseenCount(data.unseen ?? 0);
          setTotalCount(data.total ?? 0);
        })
        .catch(() => null);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [authenticated, activeFolder]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/webmail/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          password: passwordInput,
          imapHost: imapHostInput,
          imapPort: Number(imapPortInput) || 993,
          smtpHost: smtpHostInput,
          smtpPort: Number(smtpPortInput) || 465,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(
          data.error ||
            (english
              ? 'Authentication failed. Check your email and password.'
              : 'Error de autenticación. Verifique su correo y contraseña.'),
        );
        return;
      }
      setAuthenticated(true);
      setSessionEmail(data.email);
      setSessionHost(data.imapHost);
      setPasswordInput('');
      await loadFolder('INBOX');
    } catch {
      setLoginError(
        english
          ? 'Network error connecting to the mail server.'
          : 'Error de red al conectar con el servidor de correo.',
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/webmail/session', { method: 'DELETE' }).catch(() => null);
    setAuthenticated(false);
    setSessionEmail('');
    setMessages([]);
    setSelectedMessage(null);
    setSelectedUid(null);
  };

  const runDiagnostics = async (sendSelfTest = false) => {
    setDiagOpen(true);
    setDiagLoading(true);
    try {
      const res = await fetch('/api/webmail/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendSelfTest }),
      });
      const data = await res.json();
      if (res.ok) {
        setDiagData(data);
        if (sendSelfTest) {
          await loadFolder(activeFolder, true);
        }
      }
    } finally {
      setDiagLoading(false);
    }
  };

  const openMessage = async (msg: ImapMessageSummary) => {
    setSelectedUid(msg.uid);
    setLoadingMessage(true);
    setSelectedMessage(null);
    try {
      const res = await fetch(
        `/api/webmail/messages?folder=${encodeURIComponent(activeFolder)}&uid=${msg.uid}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (res.ok && data.message) {
        setSelectedMessage(data.message);
        if (!msg.seen) {
          setMessages((prev) =>
            prev.map((item) => (item.uid === msg.uid ? { ...item, seen: true } : item)),
          );
          setUnseenCount((c) => Math.max(0, c - 1));
        }
      } else {
        setMailboxError(data.error || 'No se pudo abrir el mensaje.');
      }
    } catch {
      setMailboxError('Error al descargar el mensaje.');
    } finally {
      setLoadingMessage(false);
    }
  };

  const handleToggleSeen = async (uid: number, seen: boolean) => {
    await fetch('/api/webmail/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: activeFolder, uid, seen }),
    }).catch(() => null);
    setMessages((prev) =>
      prev.map((item) => (item.uid === uid ? { ...item, seen } : item)),
    );
    setUnseenCount((c) => (seen ? Math.max(0, c - 1) : c + 1));
  };

  const handleToggleFlagged = async (uid: number, flagged: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMessages((prev) =>
      prev.map((item) => (item.uid === uid ? { ...item, flagged } : item)),
    );
    await fetch('/api/webmail/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: activeFolder, uid, flagged }),
    }).catch(() => null);
  };

  const handleMoveMessage = async (uid: number, targetFolder: string) => {
    if (!targetFolder || targetFolder === activeFolder) return;
    await fetch('/api/webmail/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: activeFolder, uid, targetFolder }),
    }).catch(() => null);
    setMessages((prev) => prev.filter((item) => item.uid !== uid));
    if (selectedUid === uid) {
      setSelectedUid(null);
      setSelectedMessage(null);
    }
  };

  const handleDeleteMessage = async (uid: number) => {
    await fetch('/api/webmail/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: activeFolder, uid }),
    }).catch(() => null);
    setMessages((prev) => prev.filter((item) => item.uid !== uid));
    if (selectedUid === uid) {
      setSelectedUid(null);
      setSelectedMessage(null);
    }
  };

  const handlePrintMessage = (detail: ImapMessageDetail) => {
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
  };

  // Populate editor HTML once modal opens
  const setEditorHtml = (initialHtml: string) => {
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = initialHtml;
        editorRef.current.focus();
      }
    }, 30);
  };

  const getCorporateSignatureHtml = () => `
    <br/>
    <div style="margin-top: 18px; padding-top: 12px; border-top: 1px solid #cfaa65; font-family: Georgia, serif; color: #181b1f;">
      <strong style="font-size: 14px; letter-spacing: 0.06em;">FAYNSHTEYN ABOGADOS &amp; CONSULTORES</strong><br/>
      <span style="font-size: 12px; color: #75541f;">${escapeHtml(sessionEmail)}</span><br/>
      <span style="font-size: 12px; color: #4c4e51;">Calle Chinchón 886, San Isidro, Lima - Perú | +51 1 612 3000</span>
    </div>
  `;

  const openNewCompose = () => {
    setComposeMode('new');
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setShowBcc(false);
    setComposeSubject('');
    setComposeAttachments([]);
    setComposeInReplyTo(undefined);
    setComposeNotice(null);
    setComposeOpen(true);
    setEditorHtml(`<p><br/></p>${getCorporateSignatureHtml()}`);
  };

  const buildQuotedHtml = (detail: ImapMessageDetail, isForward = false) => {
    const contentHtml = detail.html
      ? sanitizeEmailHtml(detail.html)
      : `<pre style="font-family: Georgia, serif; white-space: pre-wrap;">${escapeHtml(detail.text || '')}</pre>`;

    if (isForward) {
      return `
        <p><br/></p>
        ${getCorporateSignatureHtml()}
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
      ${getCorporateSignatureHtml()}
      <br/>
      <blockquote style="margin: 14px 0 0 0; padding-left: 14px; border-left: 2px solid #cfaa65; color: #4c4e51;">
        <p style="font-size: 12px; margin-bottom: 8px;">
          ${english ? 'On' : 'El'} ${escapeHtml(formatFullDate(detail.date, lang))}, <strong>${escapeHtml(detail.from)}</strong> ${english ? 'wrote:' : 'escribió:'}
        </p>
        <div>${contentHtml}</div>
      </blockquote>
    `;
  };

  const openReplyCompose = (detail: ImapMessageDetail) => {
    const sender = extractSenderName(detail.from);
    setComposeMode('reply');
    setComposeTo(sender.address || detail.from);
    setComposeCc('');
    setComposeBcc('');
    setShowBcc(false);
    setComposeSubject(
      /^(Re|RE):/i.test(detail.subject) ? detail.subject : `Re: ${detail.subject}`,
    );
    setComposeAttachments([]);
    setComposeInReplyTo(detail.messageId || undefined);
    setComposeNotice(null);
    setComposeOpen(true);
    setEditorHtml(buildQuotedHtml(detail, false));
  };

  const openReplyAllCompose = (detail: ImapMessageDetail) => {
    const sender = extractSenderName(detail.from);
    const toAddresses = extractEmailList(detail.to, sessionEmail).filter(
      (addr) => addr.toLowerCase() !== sender.address.toLowerCase(),
    );
    const ccAddresses = extractEmailList(detail.cc, sessionEmail).filter(
      (addr) => addr.toLowerCase() !== sender.address.toLowerCase(),
    );
    const allCc = Array.from(new Set([...toAddresses, ...ccAddresses]));

    setComposeMode('replyAll');
    setComposeTo(sender.address || detail.from);
    setComposeCc(allCc.join(', '));
    setComposeBcc('');
    setShowBcc(false);
    setComposeSubject(
      /^(Re|RE):/i.test(detail.subject) ? detail.subject : `Re: ${detail.subject}`,
    );
    setComposeAttachments([]);
    setComposeInReplyTo(detail.messageId || undefined);
    setComposeNotice(null);
    setComposeOpen(true);
    setEditorHtml(buildQuotedHtml(detail, false));
  };

  const openForwardCompose = (detail: ImapMessageDetail) => {
    setComposeMode('forward');
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setShowBcc(false);
    setComposeSubject(
      /^(Fwd|FW|RV):/i.test(detail.subject) ? detail.subject : `Fwd: ${detail.subject}`,
    );
    // Automatically carry over original attachments when forwarding!
    setComposeAttachments(detail.attachments ? [...detail.attachments] : []);
    setComposeInReplyTo(undefined);
    setComposeNotice(null);
    setComposeOpen(true);
    setEditorHtml(buildQuotedHtml(detail, true));
  };

  // Rich Text Formatting Commands
  const execFormat = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const handleInsertLink = () => {
    const url = window.prompt(
      english ? 'Enter link URL (https://...):' : 'Ingrese la URL del enlace (https://...):',
      'https://',
    );
    if (url && url !== 'https://') {
      execFormat('createLink', url);
    }
  };

  const handleInsertSignature = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertHTML', false, getCorporateSignatureHtml());
  };

  // File Attachment Handlers (Upload & Drag-and-Drop)
  const processUploadedFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const added: ImapAttachment[] = [];

    for (const file of Array.from(fileList)) {
      if (file.size > 18 * 1024 * 1024) {
        setComposeNotice({
          type: 'err',
          text: `${file.name} supera el límite de 18 MB por archivo.`,
        });
        continue;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = String(reader.result || '');
          const commaIdx = res.indexOf(',');
          resolve(commaIdx !== -1 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsDataURL(file);
      });
      added.push({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        contentBase64: base64,
      });
    }

    if (added.length > 0) {
      setComposeAttachments((prev) => [...prev, ...added]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setComposeAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setComposeNotice(null);
    const htmlContent = editorRef.current?.innerHTML || '';
    const plainContent = htmlToPlainText(htmlContent);

    try {
      const res = await fetch('/api/webmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDraft: true,
          to: composeTo,
          cc: composeCc || undefined,
          bcc: composeBcc || undefined,
          subject: composeSubject || '(Borrador sin asunto)',
          body: plainContent,
          htmlBody: htmlContent,
          inReplyTo: composeInReplyTo,
          attachments: composeAttachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setComposeNotice({
          type: 'err',
          text: data.error || 'No se pudo guardar el borrador.',
        });
        return;
      }
      setComposeNotice({
        type: 'ok',
        text: english
          ? 'Draft saved to your IMAP Drafts folder.'
          : 'Borrador guardado en la carpeta Borradores de cPanel.',
      });
    } catch {
      setComposeNotice({
        type: 'err',
        text: english ? 'Error saving draft.' : 'Error de red al guardar el borrador.',
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingEmail(true);
    setComposeNotice(null);

    const htmlContent = editorRef.current?.innerHTML || '';
    const plainContent = htmlToPlainText(htmlContent);

    try {
      const res = await fetch('/api/webmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          cc: composeCc || undefined,
          bcc: composeBcc || undefined,
          subject: composeSubject,
          body: plainContent || '(Mensaje)',
          htmlBody: htmlContent,
          inReplyTo: composeInReplyTo,
          attachments: composeAttachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setComposeNotice({
          type: 'err',
          text: data.error || 'Error al enviar el correo.',
        });
        return;
      }
      setComposeNotice({
        type: 'ok',
        text: english
          ? 'Message sent successfully via SMTP.'
          : 'Correo enviado exitosamente vía SMTP.',
      });
      loadFolder(activeFolder, true);
      setTimeout(() => {
        setComposeOpen(false);
        setComposeNotice(null);
      }, 1000);
    } catch {
      setComposeNotice({
        type: 'err',
        text: english ? 'Network error sending message.' : 'Error de red al enviar el correo.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return messages.filter((m) => {
      if (filterTab === 'unread' && m.seen) return false;
      if (filterTab === 'starred' && !m.flagged) return false;
      if (!q) return true;
      return (
        m.subject.toLowerCase().includes(q) ||
        m.from.toLowerCase().includes(q) ||
        m.to.toLowerCase().includes(q)
      );
    });
  }, [messages, searchQuery, filterTab]);

  const getFolderLabel = (folder: ImapFolder) => {
    if (folder.specialUse === 'inbox') return english ? 'Inbox' : 'Bandeja de entrada';
    if (folder.specialUse === 'sent') return english ? 'Sent' : 'Enviados';
    if (folder.specialUse === 'drafts') return english ? 'Drafts' : 'Borradores';
    if (folder.specialUse === 'junk') return 'Spam';
    if (folder.specialUse === 'trash') return english ? 'Trash' : 'Papelera';
    return folder.name;
  };

  const getFolderIcon = (folder: ImapFolder) => {
    if (folder.specialUse === 'inbox') return <Inbox size={17} aria-hidden="true" />;
    if (folder.specialUse === 'sent') return <Send size={17} aria-hidden="true" />;
    if (folder.specialUse === 'drafts') return <FileText size={17} aria-hidden="true" />;
    if (folder.specialUse === 'junk') return <ShieldAlert size={17} aria-hidden="true" />;
    if (folder.specialUse === 'trash') return <Trash2 size={17} aria-hidden="true" />;
    return <Folder size={17} aria-hidden="true" />;
  };

  const composeTitle = () => {
    if (composeMode === 'reply') return english ? 'Reply to Message' : 'Responder Correo';
    if (composeMode === 'replyAll') return english ? 'Reply to All' : 'Responder a Todos';
    if (composeMode === 'forward') return english ? 'Forward Message' : 'Reenviar Correo';
    return english ? 'Compose Corporate Email' : 'Redactar Correo Corporativo';
  };

  if (checkingSession) {
    return (
      <div className="site-container flex min-h-[55dvh] items-center justify-center py-16">
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <Loader2 size={20} className="animate-spin text-gold-dark" />
          <span>
            {english
              ? 'Connecting to corporate webmail...'
              : 'Verificando sesión de correo corporativo...'}
          </span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 1. CUSTOM CPANEL IMAP/SMTP WEBMAIL LOGIN VIEW
  // ============================================================================
  if (!authenticated) {
    return (
      <section className="relative isolate overflow-hidden border-b border-line bg-parchment py-12 sm:py-16 lg:py-20">
        <div className="site-container grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,28rem)] lg:gap-16">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-gold-dark uppercase">
              {english ? 'Corporate Intranet & Webmail' : 'Intranet & Correo Corporativo'}
            </p>
            <h1 className="mt-3 font-serif text-[clamp(2.1rem,4vw,3.4rem)] leading-[1.1] text-ink">
              {english ? 'Faynshteyn Corporate Mail' : 'Bandeja de Entrada Corporativa'}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
              {english
                ? 'Direct and encrypted access to your @faynshteynjuridico.com cPanel mailbox using standard IMAP/SMTP over SSL/TLS.'
                : 'Acceso directo y cifrado a su buzón corporativo de cPanel mediante los estándares IMAP4rev1 y SMTP sobre SSL/TLS.'}
            </p>

            <div className="mt-8 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
              <div className="border-l-2 border-gold pl-4">
                <p className="text-xs font-semibold tracking-wider text-ink uppercase">
                  {english ? 'Standard IMAP / SSL' : 'Sincronización IMAP / SSL'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {english
                    ? 'Real-time synchronization with your cPanel folders (Inbox, Sent, Drafts, Trash).'
                    : 'Sincronización en tiempo real con las carpetas de su servidor cPanel (Entrada, Enviados, Borradores, Papelera).'}
                </p>
              </div>
              <div className="border-l-2 border-gold pl-4">
                <p className="text-xs font-semibold tracking-wider text-ink uppercase">
                  {english ? 'Encrypted Session' : 'Sesión Cifrada AES-256'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {english
                    ? 'Protected with HTTP-only encrypted session cookies and TLS 1.3 transport.'
                    : 'Credenciales protegidas con cookies HTTP-only cifradas y transporte seguro TLS.'}
                </p>
              </div>
            </div>
          </div>

          <div className="card-surface border-t-4 border-t-gold bg-paper p-6 shadow-xs sm:p-8">
            <div className="flex items-center gap-3 border-b border-line pb-5">
              <Image
                src="/images/intro/logo_fondo_transparente.png"
                alt=""
                width={42}
                height={38}
                unoptimized
                className="h-auto w-10"
              />
              <div>
                <h2 className="font-serif text-xl text-ink">
                  {english ? 'Sign in to Webmail' : 'Iniciar sesión'}
                </h2>
                <p className="text-xs text-ink-muted">
                  Faynshteyn Abogados &amp; Consultores
                </p>
              </div>
            </div>

            {loginError && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 border border-red-800/30 bg-red-950/5 p-3.5 text-xs leading-relaxed text-red-900"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-800" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-5 space-y-5">
              <div>
                <label
                  htmlFor="wm-email"
                  className="block text-xs font-semibold tracking-wider text-ink uppercase"
                >
                  {english ? 'Corporate Email' : 'Correo corporativo'}
                </label>
                <div className="relative mt-1">
                  <input
                    id="wm-email"
                    type="email"
                    required
                    autoComplete="username"
                    value={emailInput}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="levan@faynshteynjuridico.com"
                    className="form-field pr-9"
                  />
                  <Mail
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-3.5 right-2 text-ink-muted"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="wm-password"
                  className="block text-xs font-semibold tracking-wider text-ink uppercase"
                >
                  {english ? 'Password' : 'Contraseña de cPanel / Correo'}
                </label>
                <div className="relative mt-1">
                  <input
                    id="wm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••••••"
                    className="form-field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute top-2.5 right-1 grid size-8 cursor-pointer place-items-center text-ink-muted hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gold-dark hover:text-ink"
                >
                  <Server size={14} />
                  <span>
                    {english
                      ? 'IMAP / SMTP Server Settings (cPanel)'
                      : 'Configuración de servidor IMAP / SMTP (cPanel)'}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  />
                </button>

                {showAdvanced && (
                  <div className="mt-3 grid grid-cols-3 gap-3 bg-parchment p-3.5 text-xs">
                    <div className="col-span-2">
                      <label htmlFor="wm-imap-host" className="block font-medium text-ink">
                        Servidor IMAP
                      </label>
                      <input
                        id="wm-imap-host"
                        type="text"
                        value={imapHostInput}
                        onChange={(e) => setImapHostInput(e.target.value)}
                        className="mt-1 w-full border border-line bg-paper px-2.5 py-1.5 text-ink"
                      />
                    </div>
                    <div>
                      <label htmlFor="wm-imap-port" className="block font-medium text-ink">
                        Puerto SSL
                      </label>
                      <input
                        id="wm-imap-port"
                        type="number"
                        value={imapPortInput}
                        onChange={(e) => setImapPortInput(e.target.value)}
                        className="mt-1 w-full border border-line bg-paper px-2.5 py-1.5 text-ink"
                      />
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="wm-smtp-host" className="block font-medium text-ink">
                        Servidor SMTP
                      </label>
                      <input
                        id="wm-smtp-host"
                        type="text"
                        value={smtpHostInput}
                        onChange={(e) => setSmtpHostInput(e.target.value)}
                        className="mt-1 w-full border border-line bg-paper px-2.5 py-1.5 text-ink"
                      />
                    </div>
                    <div>
                      <label htmlFor="wm-smtp-port" className="block font-medium text-ink">
                        Puerto SSL
                      </label>
                      <input
                        id="wm-smtp-port"
                        type="number"
                        value={smtpPortInput}
                        onChange={(e) => setSmtpPortInput(e.target.value)}
                        className="mt-1 w-full border border-line bg-paper px-2.5 py-1.5 text-ink"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="button-primary w-full cursor-pointer justify-center py-3 disabled:opacity-60"
              >
                {loginLoading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>
                      {english ? 'Authenticating IMAP...' : 'Autenticando con servidor IMAP...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>{english ? 'Enter Inbox' : 'Ingresar a la Bandeja'}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs text-ink-muted">
              <span>{english ? 'Direct cPanel access:' : 'Acceso externo cPanel:'}</span>
              <a
                href={`https://${imapHostInput.replace(/^mail\./, '')}:2096`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-gold-dark hover:underline"
              >
                <span>Webmail (:2096)</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ============================================================================
  // 2. AUTHENTICATED CUSTOM IMAP/SMTP WEBMAIL PANEL
  // ============================================================================
  return (
    <section className="min-h-[82dvh] border-b border-line bg-parchment py-6 sm:py-8">
      <div className="site-container">
        {/* Top account bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-line bg-ink-deep px-4 py-3 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <span className="inline-block size-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-white">{sessionEmail}</p>
              <p className="text-[11px] text-white/65">
                IMAP/TLS: {sessionHost} &bull; {totalCount}{' '}
                {english ? 'messages' : 'mensajes'} ({unseenCount}{' '}
                {english ? 'unread' : 'sin leer'})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={openNewCompose}
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink-deep transition-colors hover:bg-white"
            >
              <PenSquare size={15} />
              <span>{english ? 'Compose' : 'Redactar'}</span>
            </button>
            <button
              type="button"
              onClick={() => runDiagnostics(false)}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 border border-gold/50 px-3 py-1.5 text-xs text-gold hover:border-gold hover:bg-gold/10"
            >
              <Server size={14} />
              <span>{english ? 'Diagnose Reception' : 'Diagnosticar Recepción'}</span>
            </button>
            <button
              type="button"
              onClick={() => loadFolder(activeFolder, true)}
              disabled={loadingMailbox}
              title={english ? 'Refresh folder' : 'Actualizar bandeja'}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:border-gold hover:text-gold disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingMailbox ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{english ? 'Refresh' : 'Actualizar'}</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:border-red-400 hover:text-red-300"
            >
              <LogOut size={14} />
              <span>{english ? 'Sign out' : 'Salir'}</span>
            </button>
          </div>
        </div>

        {dnsDiagnostic?.warning && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2.5 border border-amber-700/40 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-800" />
            <div>
              <p className="font-semibold">
                {english
                  ? 'Incoming Mail DNS / MX Notice:'
                  : 'Diagnóstico de recepción de correos (DNS / MX):'}
              </p>
              <p className="mt-0.5">{dnsDiagnostic.warning}</p>
            </div>
          </div>
        )}

        {mailboxError && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 border border-red-800/30 bg-red-950/5 px-4 py-3 text-xs text-red-900"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{mailboxError}</span>
            </div>
            <button
              type="button"
              onClick={() => setMailboxError('')}
              className="cursor-pointer text-red-900 hover:underline"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Main 3-column Webmail Workspace */}
        <div className="grid min-h-[40rem] border border-line bg-paper lg:grid-cols-[14.5rem_minmax(0,23rem)_1fr]">
          {/* Column 1: Folders Sidebar */}
          <aside className="border-b border-line bg-parchment/60 p-3 lg:border-r lg:border-b-0">
            <button
              type="button"
              onClick={openNewCompose}
              className="button-primary mb-3 w-full cursor-pointer justify-center py-2.5 text-xs"
            >
              <PenSquare size={15} />
              <span>{english ? 'New Email' : 'Nuevo Correo'}</span>
            </button>

            <p className="px-2.5 py-1.5 text-[11px] font-semibold tracking-widest text-ink-muted uppercase">
              {english ? 'Folders (IMAP)' : 'Carpetas (IMAP)'}
            </p>
            <ul className="mt-1 space-y-0.5">
              {folders.map((folder) => {
                const isActive = folder.path === activeFolder;
                return (
                  <li key={folder.path}>
                    <button
                      type="button"
                      onClick={() => loadFolder(folder.path)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                        isActive
                          ? 'border-l-2 border-gold-dark bg-paper text-ink shadow-2xs'
                          : 'text-ink-muted hover:bg-paper/70 hover:text-ink'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <span className={isActive ? 'text-gold-dark' : 'text-ink-muted'}>
                          {getFolderIcon(folder)}
                        </span>
                        <span className="truncate">{getFolderLabel(folder)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {(folder.unseen ?? 0) > 0 ? (
                          <span className="rounded-xs bg-gold-dark px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {folder.unseen}
                          </span>
                        ) : (folder.total ?? 0) > 0 ? (
                          <span className="text-[10px] text-ink-muted">
                            {folder.total}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Column 2: Message List + Filters */}
          <div
            className={`flex flex-col border-b border-line lg:border-r lg:border-b-0 ${
              selectedUid !== null ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="space-y-2 border-b border-line p-3">
              <div className="relative">
                <Search
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-2.5 left-3 text-ink-muted"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    english ? 'Search by sender or subject...' : 'Buscar por remitente o asunto...'
                  }
                  className="w-full border border-line bg-parchment/50 py-1.5 pr-3 pl-9 text-xs text-ink placeholder:text-ink-muted focus:border-gold-dark focus:bg-paper focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                {(['all', 'unread', 'starred'] as const).map((tab) => {
                  const labels: Record<FilterTab, string> = {
                    all: english ? 'All' : 'Todos',
                    unread: english ? 'Unread' : 'No leídos',
                    starred: english ? 'Starred' : 'Destacados',
                  };
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFilterTab(tab)}
                      className={`cursor-pointer px-2.5 py-1 font-medium transition-colors ${
                        filterTab === tab
                          ? 'bg-ink text-white'
                          : 'bg-parchment/70 text-ink-muted hover:text-ink'
                      }`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
            </div>

            {loadingMailbox ? (
              <div className="flex flex-1 items-center justify-center p-10 text-xs text-ink-muted">
                <Loader2 size={18} className="mr-2 animate-spin text-gold-dark" />
                <span>{english ? 'Synchronizing messages...' : 'Sincronizando mensajes...'}</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-xs text-ink-muted">
                <MailOpen size={28} strokeWidth={1.3} className="mb-2 text-ink-muted/60" />
                <p>
                  {english ? 'No messages match this view.' : 'No hay mensajes en esta vista.'}
                </p>
              </div>
            ) : (
              <ul className="max-h-[38rem] flex-1 divide-y divide-line overflow-y-auto">
                {filteredMessages.map((msg) => {
                  const sender = extractSenderName(msg.from);
                  const isSelected = selectedUid === msg.uid;
                  return (
                    <li key={msg.uid} className="relative">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openMessage(msg)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openMessage(msg);
                          }
                        }}
                        className={`w-full cursor-pointer p-3.5 text-left transition-colors ${
                          isSelected
                            ? 'bg-parchment'
                            : msg.seen
                              ? 'bg-paper hover:bg-parchment/50'
                              : 'bg-gold/8 hover:bg-gold/14'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`flex items-center gap-1.5 truncate text-xs ${
                              msg.seen ? 'font-normal text-ink-muted' : 'font-semibold text-ink'
                            }`}
                          >
                            {!msg.seen && (
                              <span
                                className="inline-block size-2 shrink-0 rounded-full bg-gold-dark"
                                aria-label={english ? 'Unread' : 'No leído'}
                              />
                            )}
                            <span className="truncate">{sender.name}</span>
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            <time className="text-[11px] text-ink-muted">
                              {formatDate(msg.date, lang)}
                            </time>
                            <button
                              type="button"
                              onClick={(e) => handleToggleFlagged(msg.uid, !msg.flagged, e)}
                              aria-label={english ? 'Star message' : 'Destacar correo'}
                              className={`cursor-pointer ${
                                msg.flagged
                                  ? 'text-gold-dark'
                                  : 'text-ink-muted/40 hover:text-gold-dark'
                              }`}
                            >
                              <Star
                                size={14}
                                fill={msg.flagged ? 'currentColor' : 'none'}
                              />
                            </button>
                          </div>
                        </div>
                        <p
                          className={`mt-1 line-clamp-2 text-xs leading-snug ${
                            msg.seen ? 'font-normal text-ink' : 'font-semibold text-ink'
                          }`}
                        >
                          {msg.subject}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Column 3: Message Reading Pane */}
          <div className="flex flex-col bg-paper">
            {selectedUid === null ? (
              <div className="hidden flex-1 flex-col items-center justify-center p-12 text-center text-ink-muted lg:flex">
                <Mail size={36} strokeWidth={1.2} className="mb-3 text-gold-dark/70" />
                <p className="font-serif text-lg text-ink">
                  {english ? 'Select a message to read' : 'Seleccione un correo para leerlo'}
                </p>
                <p className="mt-1 max-w-xs text-xs">
                  {english
                    ? 'Click any email on the left list or compose a new corporate message.'
                    : 'Haga clic en cualquier mensaje de la lista izquierda o redacte un nuevo correo corporativo.'}
                </p>
              </div>
            ) : loadingMessage ? (
              <div className="flex flex-1 items-center justify-center p-12 text-xs text-ink-muted">
                <Loader2 size={20} className="mr-2.5 animate-spin text-gold-dark" />
                <span>
                  {english ? 'Loading message content...' : 'Descargando contenido del correo...'}
                </span>
              </div>
            ) : selectedMessage ? (
              <article className="flex flex-1 flex-col">
                {/* Reader Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-parchment/50 px-4 py-2.5 sm:px-6">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUid(null);
                      setSelectedMessage(null);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gold-dark hover:text-ink lg:hidden"
                  >
                    <ArrowLeft size={15} />
                    <span>{english ? 'Back to list' : 'Volver a la lista'}</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openReplyCompose(selectedMessage)}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
                    >
                      <Reply size={14} />
                      <span>{english ? 'Reply' : 'Responder'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openReplyAllCompose(selectedMessage)}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
                    >
                      <ReplyAll size={14} />
                      <span>{english ? 'Reply All' : 'Responder a todos'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openForwardCompose(selectedMessage)}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
                    >
                      <Forward size={14} />
                      <span>{english ? 'Forward' : 'Reenviar'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Move to folder dropdown */}
                    <div className="relative inline-flex items-center">
                      <FolderInput
                        size={13}
                        className="pointer-events-none absolute left-2.5 text-ink-muted"
                      />
                      <select
                        aria-label={english ? 'Move to folder' : 'Mover a carpeta'}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleMoveMessage(selectedMessage.uid, e.target.value);
                          }
                        }}
                        className="min-h-8 cursor-pointer border border-line bg-paper py-1 pr-2 pl-7 text-xs font-medium text-ink hover:border-gold-dark focus:outline-none"
                      >
                        <option value="">
                          {english ? 'Move to...' : 'Mover a...'}
                        </option>
                        {folders
                          .filter((f) => f.path !== activeFolder)
                          .map((f) => (
                            <option key={f.path} value={f.path}>
                              {getFolderLabel(f)}
                            </option>
                          ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleSeen(selectedMessage.uid, false)}
                      title={english ? 'Mark as unread' : 'Marcar como no leído'}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
                    >
                      <Mail size={14} />
                      <span className="hidden xl:inline">
                        {english ? 'Unread' : 'No leído'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrintMessage(selectedMessage)}
                      title={english ? 'Print message' : 'Imprimir correo'}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
                    >
                      <Printer size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(selectedMessage.uid)}
                      className="inline-flex min-h-8 cursor-pointer items-center gap-1 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-red-800 hover:border-red-800 hover:bg-red-950/5"
                    >
                      <Trash2 size={14} />
                      <span>{english ? 'Delete' : 'Eliminar'}</span>
                    </button>
                  </div>
                </div>

                {/* Email Headers */}
                <header className="border-b border-line px-5 py-4 sm:px-7">
                  <h2 className="font-serif text-xl leading-snug text-ink sm:text-2xl">
                    {selectedMessage.subject}
                  </h2>
                  <div className="mt-3 grid gap-1 text-xs text-ink-muted">
                    <p>
                      <span className="font-semibold text-ink">
                        {english ? 'From:' : 'De:'}
                      </span>{' '}
                      {selectedMessage.from}
                    </p>
                    {selectedMessage.to && (
                      <p>
                        <span className="font-semibold text-ink">
                          {english ? 'To:' : 'Para:'}
                        </span>{' '}
                        {selectedMessage.to}
                      </p>
                    )}
                    {selectedMessage.cc && (
                      <p>
                        <span className="font-semibold text-ink">CC:</span>{' '}
                        {selectedMessage.cc}
                      </p>
                    )}
                    {selectedMessage.date && (
                      <p>
                        <span className="font-semibold text-ink">
                          {english ? 'Date:' : 'Fecha:'}
                        </span>{' '}
                        {formatFullDate(selectedMessage.date, lang)}
                      </p>
                    )}
                  </div>

                  {/* Attachments bar */}
                  {selectedMessage.attachments.length > 0 && (
                    <div className="mt-4 border-t border-line pt-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
                        <Paperclip size={13} className="text-gold-dark" />
                        <span>
                          {selectedMessage.attachments.length}{' '}
                          {english ? 'Attachment(s)' : 'Archivo(s) adjunto(s)'}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedMessage.attachments.map((att, idx) => (
                          <a
                            key={`${att.filename}-${idx}`}
                            href={`data:${att.contentType};base64,${att.contentBase64}`}
                            download={att.filename}
                            className="inline-flex items-center gap-2 border border-line bg-parchment px-3 py-1.5 text-xs text-ink hover:border-gold-dark hover:text-gold-dark"
                          >
                            <Download size={13} />
                            <span className="max-w-48 truncate font-medium">
                              {att.filename}
                            </span>
                            <span className="text-[11px] text-ink-muted">
                              ({formatBytes(att.size)})
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </header>

                {/* Email Body */}
                <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                  {selectedMessage.html ? (
                    <div
                      className="prose max-w-none text-sm leading-relaxed text-ink [&_a]:text-gold-dark [&_a]:underline [&_img]:max-w-full"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeEmailHtml(selectedMessage.html),
                      }}
                    />
                  ) : (
                    <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-ink">
                      {selectedMessage.text ||
                        (english
                          ? '(No text content)'
                          : '(Mensaje sin contenido de texto)')}
                    </pre>
                  )}
                </div>

                {/* Quick Bottom Reply / Reply All / Forward Bar */}
                <footer className="flex flex-wrap items-center gap-2.5 border-t border-line bg-parchment/40 px-5 py-3.5 sm:px-7">
                  <button
                    type="button"
                    onClick={() => openReplyCompose(selectedMessage)}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-paper px-4 py-1.5 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
                  >
                    <Reply size={14} />
                    <span>{english ? 'Reply' : 'Responder'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openReplyAllCompose(selectedMessage)}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-paper px-4 py-1.5 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
                  >
                    <ReplyAll size={14} />
                    <span>{english ? 'Reply to All' : 'Responder a todos'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openForwardCompose(selectedMessage)}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-paper px-4 py-1.5 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
                  >
                    <Forward size={14} />
                    <span>{english ? 'Forward' : 'Reenviar'}</span>
                  </button>
                </footer>
              </article>
            ) : null}
          </div>
        </div>
      </div>

      {/* ============================================================================
          3. RICH TEXT COMPOSE / REPLY / REPLY ALL / FORWARD MODAL WITH ATTACHMENTS
         ============================================================================ */}
      {/* Compose / Reply Modal */}
      {diagOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4"
        >
          <div className="my-auto w-full max-w-2xl border border-line bg-paper shadow-2xl">
            <div className="flex items-center justify-between border-b border-line bg-ink-deep px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <Server size={17} className="text-gold" />
                <h2 className="font-serif text-lg text-white">
                  Diagnóstico de Recepción de Correos (cPanel &amp; DNS MX)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDiagOpen(false)}
                className="cursor-pointer text-white/80 hover:text-gold"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[82dvh] space-y-4 overflow-y-auto p-5 text-xs leading-relaxed text-ink">
              {diagLoading && !diagData ? (
                <div className="flex items-center justify-center py-10 text-ink-muted">
                  <Loader2 size={20} className="mr-2 animate-spin text-gold-dark" />
                  <span>Analizando servidor cPanel y registros DNS MX del dominio...</span>
                </div>
              ) : diagData ? (
                <>
                  <div className="grid gap-3 border border-line bg-parchment p-3.5 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-ink-muted uppercase">Buzón conectado</p>
                      <p className="mt-0.5 font-medium text-ink">{diagData.email}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-ink-muted uppercase">Servidor cPanel IMAP real</p>
                      <p className="mt-0.5 font-medium text-ink">
                        {diagData.connectedImapServer} (IP: <strong className="text-gold-dark">{diagData.connectedImapIp}</strong>)
                      </p>
                    </div>
                    {diagData.nameServers && diagData.nameServers.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="font-semibold text-ink-muted uppercase">
                          Servidores DNS autoritativos (Nameservers donde debes editar el MX)
                        </p>
                        <p className="mt-0.5 font-mono text-ink">
                          {diagData.nameServers.join(' • ')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* MX Analysis */}
                  <div className="border border-line p-4">
                    <h3 className="font-serif text-base text-ink">
                      1. ¿A dónde está enviando Gmail los correos de @{diagData.domain}? (Registros MX)
                    </h3>
                    <div className="mt-2 grid gap-2 border border-line bg-parchment/40 p-2.5 text-[11px] sm:grid-cols-2">
                      <div>
                        <strong>IP de {diagData.domain} (Web Vercel):</strong>{' '}
                        <code>{diagData.rootDomainIps.join(', ') || 'N/A'}</code>
                      </div>
                      <div>
                        <strong>IP de mail.{diagData.domain}:</strong>{' '}
                        <code
                          className={
                            diagData.mailSubdomainIps.includes(diagData.connectedImapIp)
                              ? 'font-bold text-emerald-800'
                              : 'font-bold text-red-800'
                          }
                        >
                          {diagData.mailSubdomainIps.join(', ') || 'No existe registro A'}
                        </code>
                      </div>
                    </div>
                    {diagData.mxRecords.length === 0 ? (
                      <div className="mt-2 border border-red-800/30 bg-red-950/5 p-3 text-red-900">
                        <strong>Problema detectado:</strong> El dominio <code>{diagData.domain}</code> no tiene ningún registro <strong>MX</strong> configurado en su DNS público. Por eso cuando envías un correo desde Gmail, Gmail no sabe a qué servidor entregarlo.
                      </div>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {diagData.mxRecords.map((mx) => (
                          <li key={mx.exchange} className="border border-line bg-parchment/50 p-2.5">
                            <div>
                              <strong>Servidor MX (Prioridad {mx.priority}):</strong>{' '}
                              <code>{mx.exchange}</code> &rarr; IP:{' '}
                              <code>{mx.ips.join(', ') || 'Sin IP (No existe registro A)'}</code>
                            </div>
                            {mx.isCloudflareProxy && (
                              <p className="mt-1 font-medium text-red-800">
                                ⚠️ Este registro MX pasa por el Proxy de Cloudflare (nube naranja). Cloudflare bloquea el tráfico de correo entrante (puerto 25). Debes cambiar <code>{mx.exchange}</code> a &ldquo;DNS Only&rdquo; (nube gris) apuntando a <code>{diagData.connectedImapIp}</code>.
                              </p>
                            )}
                            {!mx.isCloudflareProxy && !mx.ips.includes(diagData.connectedImapIp) && (
                              <p className="mt-1 font-medium text-amber-900">
                                ⚠️ Atención: El registro MX apunta a la IP <code>{mx.ips.join(', ') || 'ninguna'}</code>, pero tu servidor cPanel donde está tu buzón tiene la IP <code>{diagData.connectedImapIp}</code>.
                              </p>
                            )}
                            {!mx.isCloudflareProxy && mx.ips.includes(diagData.connectedImapIp) && (
                              <p className="mt-1 font-medium text-emerald-800">
                                ✓ El registro MX apunta correctamente a la IP de tu servidor cPanel ({diagData.connectedImapIp}).
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Folders summary on the server */}
                  <div className="border border-line p-4">
                    <h3 className="font-serif text-base text-ink">
                      2. Mensajes existentes actualmente en tu servidor cPanel
                    </h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {diagData.foldersSummary?.map((f) => (
                        <div key={f.path} className="border border-line bg-parchment/40 p-2">
                          <p className="truncate font-semibold text-ink">{f.path}</p>
                          <p className="text-ink-muted">
                            {f.total} total ({f.unseen} sin leer)
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Self-test button */}
                  <div className="border border-line bg-parchment/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-base text-ink">
                          3. Prueba de entrega interna en cPanel
                        </h3>
                        <p className="text-ink-muted">
                          Envía un correo de prueba desde tu propio servidor hacia {diagData.email} para verificar si cPanel entrega correos locales en tu Bandeja de entrada.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={diagLoading}
                        onClick={() => runDiagnostics(true)}
                        className="button-primary cursor-pointer px-4 py-2 text-xs disabled:opacity-50"
                      >
                        {diagLoading ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Probando...</span>
                          </>
                        ) : (
                          <>
                            <Send size={14} />
                            <span>Enviar correo de prueba a mi buzón</span>
                          </>
                        )}
                      </button>
                    </div>

                    {diagData.selfTestResult && (
                      <div
                        className={`mt-3 border p-3 ${
                          diagData.selfTestResult.ok
                            ? 'border-emerald-700/30 bg-emerald-950/5 text-emerald-900'
                            : 'border-red-800/30 bg-red-950/5 text-red-900'
                        }`}
                      >
                        {diagData.selfTestResult.detail}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {composeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="compose-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-3 sm:p-5"
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFiles(true);
            }}
            onDragLeave={() => setIsDraggingFiles(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFiles(false);
              processUploadedFiles(e.dataTransfer.files);
            }}
            className={`my-auto flex max-h-[94dvh] w-full max-w-4xl flex-col border bg-paper shadow-2xl ${
              isDraggingFiles ? 'border-2 border-gold' : 'border-line'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line bg-ink-deep px-5 py-3.5 text-white">
              <div className="flex items-center gap-2.5">
                <PenSquare size={17} className="text-gold" />
                <h2 id="compose-modal-title" className="font-serif text-lg text-white">
                  {composeTitle()}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="cursor-pointer text-white/80 hover:text-gold"
                aria-label={english ? 'Close' : 'Cerrar'}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSendEmail}
              className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6"
            >
              {composeNotice && (
                <div
                  className={`mb-4 flex items-center gap-2 border p-3 text-xs ${
                    composeNotice.type === 'ok'
                      ? 'border-emerald-700/30 bg-emerald-950/5 text-emerald-900'
                      : 'border-red-800/30 bg-red-950/5 text-red-900'
                  }`}
                >
                  {composeNotice.type === 'ok' ? (
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-700" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 text-red-800" />
                  )}
                  <span>{composeNotice.text}</span>
                </div>
              )}

              {/* Recipients: Para / CC / CCO */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="compose-to"
                      className="block text-xs font-semibold tracking-wider text-ink uppercase"
                    >
                      {english ? 'To' : 'Para'} *
                    </label>
                    {!showBcc && (
                      <button
                        type="button"
                        onClick={() => setShowBcc(true)}
                        className="cursor-pointer text-[11px] font-medium text-gold-dark hover:underline"
                      >
                        + CCO (BCC)
                      </button>
                    )}
                  </div>
                  <input
                    id="compose-to"
                    type="text"
                    required
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="cliente@empresa.com, socio@firma.com"
                    className="form-field py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="compose-cc"
                    className="block text-xs font-semibold tracking-wider text-ink uppercase"
                  >
                    CC
                  </label>
                  <input
                    id="compose-cc"
                    type="text"
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    placeholder={english ? 'Copy recipients (optional)' : 'Con copia a (opcional)'}
                    className="form-field py-1.5 text-sm"
                  />
                </div>
              </div>

              {showBcc && (
                <div className="mt-3">
                  <label
                    htmlFor="compose-bcc"
                    className="block text-xs font-semibold tracking-wider text-ink uppercase"
                  >
                    {english ? 'BCC (Blind Carbon Copy)' : 'CCO (Copia oculta)'}
                  </label>
                  <input
                    id="compose-bcc"
                    type="text"
                    value={composeBcc}
                    onChange={(e) => setComposeBcc(e.target.value)}
                    placeholder={
                      english
                        ? 'Hidden recipients separated by comma'
                        : 'Destinatarios en copia oculta separados por coma'
                    }
                    className="form-field py-1.5 text-sm"
                  />
                </div>
              )}

              <div className="mt-3">
                <label
                  htmlFor="compose-subject"
                  className="block text-xs font-semibold tracking-wider text-ink uppercase"
                >
                  {english ? 'Subject' : 'Asunto'} *
                </label>
                <input
                  id="compose-subject"
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder={english ? 'Legal advisory subject' : 'Asunto del correo'}
                  className="form-field py-1.5 text-sm"
                />
              </div>

              {/* WYSIWYG Formatting Toolbar */}
              <div className="mt-4 flex flex-wrap items-center gap-1 border border-b-0 border-line bg-parchment px-2.5 py-2">
                {/* Text Style / Heading */}
                <select
                  aria-label={english ? 'Text format' : 'Formato de texto'}
                  defaultValue="P"
                  onChange={(e) => execFormat('formatBlock', e.target.value)}
                  className="mr-1 h-7 cursor-pointer border border-line bg-paper px-2 text-xs text-ink focus:outline-none"
                >
                  <option value="P">{english ? 'Normal' : 'Texto normal'}</option>
                  <option value="H2">{english ? 'Heading' : 'Título grande'}</option>
                  <option value="H3">{english ? 'Subheading' : 'Subtítulo'}</option>
                  <option value="BLOCKQUOTE">{english ? 'Quote' : 'Cita'}</option>
                </select>

                {/* Font size */}
                <select
                  aria-label={english ? 'Font size' : 'Tamaño de fuente'}
                  defaultValue="3"
                  onChange={(e) => execFormat('fontSize', e.target.value)}
                  className="mr-1 h-7 cursor-pointer border border-line bg-paper px-2 text-xs text-ink focus:outline-none"
                >
                  <option value="2">{english ? 'Small' : 'Pequeña'}</option>
                  <option value="3">{english ? 'Normal' : 'Mediana'}</option>
                  <option value="4">{english ? 'Large' : 'Grande'}</option>
                  <option value="5">{english ? 'Extra Large' : 'Muy grande'}</option>
                </select>

                {/* Text Color */}
                <select
                  aria-label={english ? 'Text color' : 'Color de texto'}
                  defaultValue="#181b1f"
                  onChange={(e) => execFormat('foreColor', e.target.value)}
                  className="mr-1 h-7 cursor-pointer border border-line bg-paper px-2 text-xs text-ink focus:outline-none"
                >
                  <option value="#181b1f">{english ? 'Ink Black' : 'Negro tinta'}</option>
                  <option value="#75541f">{english ? 'Corporate Gold' : 'Dorado estudio'}</option>
                  <option value="#1e3a8a">{english ? 'Navy Blue' : 'Azul corporativo'}</option>
                  <option value="#4c4e51">{english ? 'Slate Gray' : 'Gris'}</option>
                  <option value="#991b1b">{english ? 'Crimson' : 'Rojo'}</option>
                </select>

                <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />

                <button
                  type="button"
                  onClick={() => execFormat('bold')}
                  title={english ? 'Bold' : 'Negrita'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('italic')}
                  title={english ? 'Italic' : 'Cursiva'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <Italic size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('underline')}
                  title={english ? 'Underline' : 'Subrayado'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <Underline size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('strikeThrough')}
                  title={english ? 'Strikethrough' : 'Tachado'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <Strikethrough size={14} />
                </button>

                <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />

                <button
                  type="button"
                  onClick={() => execFormat('justifyLeft')}
                  title={english ? 'Align left' : 'Alinear a la izquierda'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('justifyCenter')}
                  title={english ? 'Align center' : 'Centrar'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('justifyRight')}
                  title={english ? 'Align right' : 'Alinear a la derecha'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <AlignRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('justifyFull')}
                  title={english ? 'Justify' : 'Justificar'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <AlignJustify size={14} />
                </button>

                <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />

                <button
                  type="button"
                  onClick={() => execFormat('insertUnorderedList')}
                  title={english ? 'Bulleted list' : 'Lista con viñetas'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('insertOrderedList')}
                  title={english ? 'Numbered list' : 'Lista numerada'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <ListOrdered size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('formatBlock', 'BLOCKQUOTE')}
                  title={english ? 'Quote block' : 'Cita'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <Quote size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleInsertLink}
                  title={english ? 'Insert link' : 'Insertar enlace'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <Link2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('removeFormat')}
                  title={english ? 'Clear formatting' : 'Limpiar formato'}
                  className="grid size-7 cursor-pointer place-items-center border border-transparent text-ink hover:border-line hover:bg-paper"
                >
                  <Eraser size={14} />
                </button>

                <span className="mx-0.5 h-5 w-px bg-line" aria-hidden="true" />

                <button
                  type="button"
                  onClick={handleInsertSignature}
                  title={english ? 'Insert firm signature' : 'Insertar firma del estudio'}
                  className="inline-flex h-7 cursor-pointer items-center gap-1 border border-line bg-paper px-2 text-[11px] font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
                >
                  <FileSignature size={13} />
                  <span>{english ? 'Signature' : 'Firma'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title={english ? 'Attach files' : 'Adjuntar archivos'}
                  className="ml-auto inline-flex h-7 cursor-pointer items-center gap-1.5 border border-gold-dark bg-paper px-2.5 text-[11px] font-semibold text-gold-dark hover:bg-gold-dark hover:text-white"
                >
                  <Paperclip size={13} />
                  <span>{english ? 'Attach files' : 'Adjuntar archivos'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => processUploadedFiles(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* Editable Rich Text Area */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label={english ? 'Email message body' : 'Cuerpo del correo'}
                className="min-h-60 flex-1 overflow-y-auto border border-line bg-paper p-4 text-sm leading-relaxed text-ink focus:border-gold-dark focus:outline-none [&_a]:text-gold-dark [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gold [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
              />

              {/* Attachments Upload & Preview Zone */}
              <div className="mt-3">
                {composeAttachments.length > 0 ? (
                  <div className="border border-line bg-parchment/60 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-ink">
                        <Paperclip size={13} className="text-gold-dark" />
                        {composeAttachments.length}{' '}
                        {english ? 'file(s) attached' : 'archivo(s) adjunto(s)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer font-medium text-gold-dark hover:underline"
                      >
                        + {english ? 'Add more files' : 'Agregar más archivos'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {composeAttachments.map((att, idx) => (
                        <div
                          key={`${att.filename}-${idx}`}
                          className="inline-flex items-center gap-2 border border-line bg-paper px-2.5 py-1.5 text-xs text-ink"
                        >
                          <Paperclip size={12} className="text-gold-dark" />
                          <span className="max-w-44 truncate font-medium">
                            {att.filename}
                          </span>
                          <span className="text-[11px] text-ink-muted">
                            ({formatBytes(att.size)})
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            aria-label={english ? 'Remove attachment' : 'Quitar adjunto'}
                            className="ml-1 cursor-pointer text-ink-muted hover:text-red-700"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 border border-dashed border-line bg-parchment/30 py-2.5 text-xs text-ink-muted transition-colors hover:border-gold-dark hover:text-ink"
                  >
                    <Upload size={14} className="text-gold-dark" />
                    <span>
                      {english
                        ? 'Click or drag & drop files here to attach (PDF, Word, Excel, Images)'
                        : 'Haga clic o arrastre archivos aquí para adjuntar (PDF, Word, Excel, Imágenes)'}
                    </span>
                  </button>
                )}
              </div>

              {/* Footer Buttons: Save Draft / Cancel / Send */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={savingDraft || sendingEmail}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-line bg-parchment px-4 text-xs font-medium text-ink hover:border-gold-dark disabled:opacity-50"
                >
                  {savingDraft ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span>{english ? 'Save Draft' : 'Guardar borrador'}</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setComposeOpen(false)}
                    className="inline-flex min-h-10 cursor-pointer items-center border border-line px-4 text-xs font-medium text-ink hover:border-ink"
                  >
                    {english ? 'Cancel' : 'Cancelar'}
                  </button>
                  <button
                    type="submit"
                    disabled={sendingEmail}
                    className="button-primary min-h-10 cursor-pointer px-5 py-2 text-xs disabled:opacity-60"
                  >
                    {sendingEmail ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>{english ? 'Sending...' : 'Enviando...'}</span>
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>{english ? 'Send Email' : 'Enviar Correo'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
