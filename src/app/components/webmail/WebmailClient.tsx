'use client';

import { AlertCircle, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Language } from '../../../utils/i18n';
import type { DnsMailDiagnostic } from '../../../utils/webmail';
import {
  buildQuotedHtml,
  extractEmailList,
  extractSenderName,
  getCorporateSignatureHtml,
} from './helpers';
import type {
  ComposeMode,
  FilterTab,
  ImapAttachment,
  ImapFolder,
  ImapMessageDetail,
  ImapMessageSummary,
} from './types';
import WebmailComposeModal from './WebmailComposeModal';
import WebmailHeaderBar from './WebmailHeaderBar';
import WebmailLogin from './WebmailLogin';
import WebmailMessageList from './WebmailMessageList';
import WebmailMessageReader from './WebmailMessageReader';
import { WebmailRecoveryPrompt } from './WebmailRecoveryForms';
import WebmailSidebar from './WebmailSidebar';

type Props = {
  lang: Language;
};

export default function WebmailClient({ lang }: Props) {
  const english = lang === 'en';

  // Session state
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionEmail, setSessionEmail] = useState('');
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);

  // Inbox state
  const [folders, setFolders] = useState<ImapFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState('INBOX');
  const [messages, setMessages] = useState<ImapMessageSummary[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [mailboxLoading, setMailboxLoading] = useState<'opening' | 'refreshing' | null>(null);
  const [mailboxError, setMailboxError] = useState('');
  const [dnsDiagnostic, setDnsDiagnostic] = useState<DnsMailDiagnostic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  // Active message reader state
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ImapMessageDetail | null>(null);
  const [selectedThread, setSelectedThread] = useState<ImapMessageDetail[]>([]);
  const [loadingMessage, setLoadingMessage] = useState(false);

  // Compose modal state
  const [composeState, setComposeState] = useState<{
    open: boolean;
    mode: ComposeMode;
    to: string;
    cc: string;
    subject: string;
    html: string;
    attachments: ImapAttachment[];
    inReplyTo?: string;
  }>({
    open: false,
    mode: 'new',
    to: '',
    cc: '',
    subject: '',
    html: '',
    attachments: [],
  });

  const loadFolder = useCallback(
    async (folderPath: string, preserveSelection = false) => {
      setMailboxLoading(preserveSelection ? 'refreshing' : 'opening');
      setMailboxError('');
      if (!preserveSelection) {
        setSelectedUid(null);
        setSelectedMessage(null);
        setSelectedThread([]);
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
        setMailboxLoading(null);
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

  // Background auto-sync every 8 seconds
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

      if (selectedUid !== null) {
        fetch(
          `/api/webmail/messages?folder=${encodeURIComponent(activeFolder)}&uid=${selectedUid}`,
          { cache: 'no-store' },
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.message) {
              setSelectedMessage(data.message);
              setSelectedThread(
                Array.isArray(data.thread) && data.thread.length > 0
                  ? data.thread
                  : [data.message],
              );
            }
          })
          .catch(() => null);
      }
    }, 8000);
    return () => window.clearInterval(interval);
  }, [authenticated, activeFolder, selectedUid]);

  const handleLogout = async () => {
    await fetch('/api/webmail/session', { method: 'DELETE' }).catch(() => null);
    setAuthenticated(false);
    setSessionEmail('');
    setMessages([]);
    setSelectedMessage(null);
    setSelectedThread([]);
    setSelectedUid(null);
  };

  const openMessage = async (msg: ImapMessageSummary) => {
    setSelectedUid(msg.uid);
    setLoadingMessage(true);
    setSelectedMessage(null);
    setSelectedThread([]);
    try {
      const res = await fetch(
        `/api/webmail/messages?folder=${encodeURIComponent(activeFolder)}&uid=${msg.uid}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (res.ok && data.message) {
        setSelectedMessage(data.message);
        setSelectedThread(
          Array.isArray(data.thread) && data.thread.length > 0
            ? data.thread
            : [data.message],
        );
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
      setSelectedThread([]);
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
      setSelectedThread([]);
    }
  };

  const openNewCompose = () => {
    setComposeState({
      open: true,
      mode: 'new',
      to: '',
      cc: '',
      subject: '',
      html: `<p><br/></p>${getCorporateSignatureHtml(sessionEmail)}`,
      attachments: [],
    });
  };

  const openReplyCompose = (detail: ImapMessageDetail) => {
    const sender = extractSenderName(detail.from);
    setComposeState({
      open: true,
      mode: 'reply',
      to: sender.address || detail.from,
      cc: '',
      subject: /^(Re|RE):/i.test(detail.subject) ? detail.subject : `Re: ${detail.subject}`,
      html: buildQuotedHtml(detail, sessionEmail, lang, false),
      attachments: [],
      inReplyTo: detail.messageId || undefined,
    });
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

    setComposeState({
      open: true,
      mode: 'replyAll',
      to: sender.address || detail.from,
      cc: allCc.join(', '),
      subject: /^(Re|RE):/i.test(detail.subject) ? detail.subject : `Re: ${detail.subject}`,
      html: buildQuotedHtml(detail, sessionEmail, lang, false),
      attachments: [],
      inReplyTo: detail.messageId || undefined,
    });
  };

  const openForwardCompose = (detail: ImapMessageDetail) => {
    setComposeState({
      open: true,
      mode: 'forward',
      to: '',
      cc: '',
      subject: /^(Fwd|FW|RV):/i.test(detail.subject)
        ? detail.subject
        : `Fwd: ${detail.subject}`,
      html: buildQuotedHtml(detail, sessionEmail, lang, true),
      attachments: detail.attachments ? [...detail.attachments] : [],
    });
  };

  const handleAfterSent = () => {
    loadFolder(activeFolder, true);
    if (selectedUid !== null) {
      fetch(
        `/api/webmail/messages?folder=${encodeURIComponent(activeFolder)}&uid=${selectedUid}`,
        { cache: 'no-store' },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.message) {
            setSelectedMessage(d.message);
            setSelectedThread(
              Array.isArray(d.thread) && d.thread.length > 0 ? d.thread : [d.message],
            );
          }
        })
        .catch(() => null);
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

  if (checkingSession) {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center p-5">
        <div role="status" className="flex items-center gap-3 text-sm text-ink-muted">
          <Loader2 aria-hidden="true" size={20} className="shrink-0 animate-spin text-gold-dark" />
          <span>
            {english
              ? 'Connecting to corporate webmail...'
              : 'Verificando sesión de correo corporativo...'}
          </span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <WebmailLogin
        lang={lang}
        onAuthenticated={({ email, needsRecoveryEmail }) => {
          setAuthenticated(true);
          setSessionEmail(email);
          setShowRecoveryPrompt(needsRecoveryEmail);
          loadFolder('INBOX');
        }}
      />
    );
  }

  return (
    <section className="flex min-h-dvh min-w-0 flex-1 flex-col p-3 sm:p-4 lg:h-dvh lg:min-h-[36rem] lg:flex-none">
      <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
        <WebmailHeaderBar
          lang={lang}
          sessionEmail={sessionEmail}
          totalCount={totalCount}
          unseenCount={unseenCount}
          loadingMailbox={mailboxLoading !== null}
          onCompose={openNewCompose}
          onRefresh={() => loadFolder(activeFolder, true)}
          onLogout={handleLogout}
        />

        {dnsDiagnostic?.warning && (
          <div
            role="status"
            className="mb-4 flex shrink-0 items-start gap-2.5 border border-amber-700/40 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950"
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
            className="mb-4 flex shrink-0 items-center justify-between gap-3 border border-red-800/30 bg-red-950/5 px-4 py-3 text-xs text-red-900"
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

        <div className="card-surface grid flex-1 overflow-hidden lg:min-h-0 lg:grid-cols-[14.5rem_minmax(0,23rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <WebmailSidebar
            lang={lang}
            folders={folders}
            activeFolder={activeFolder}
            onSelectFolder={(path) => loadFolder(path)}
            onCompose={openNewCompose}
          />

          <WebmailMessageList
            lang={lang}
            messages={filteredMessages}
            selectedUid={selectedUid}
            loadingMailbox={mailboxLoading === 'opening'}
            searchQuery={searchQuery}
            filterTab={filterTab}
            onSearchChange={setSearchQuery}
            onFilterTabChange={setFilterTab}
            onSelectMessage={openMessage}
            onToggleFlagged={handleToggleFlagged}
          />

          <WebmailMessageReader
            lang={lang}
            selectedUid={selectedUid}
            loadingMessage={loadingMessage}
            selectedMessage={selectedMessage}
            selectedThread={selectedThread}
            folders={folders}
            activeFolder={activeFolder}
            onCloseReader={() => {
              setSelectedUid(null);
              setSelectedMessage(null);
              setSelectedThread([]);
            }}
            onReply={openReplyCompose}
            onReplyAll={openReplyAllCompose}
            onForward={openForwardCompose}
            onMoveMessage={handleMoveMessage}
            onMarkUnread={(uid) => handleToggleSeen(uid, false)}
            onDeleteMessage={handleDeleteMessage}
          />
        </div>
      </div>

      {showRecoveryPrompt && (
        <WebmailRecoveryPrompt lang={lang} onDismiss={() => setShowRecoveryPrompt(false)} />
      )}

      {composeState.open && (
        <WebmailComposeModal
          lang={lang}
          sessionEmail={sessionEmail}
          mode={composeState.mode}
          initialTo={composeState.to}
          initialCc={composeState.cc}
          initialSubject={composeState.subject}
          initialHtml={composeState.html}
          initialAttachments={composeState.attachments}
          inReplyTo={composeState.inReplyTo}
          onClose={() => setComposeState((prev) => ({ ...prev, open: false }))}
          onSent={handleAfterSent}
        />
      )}
    </section>
  );
}
