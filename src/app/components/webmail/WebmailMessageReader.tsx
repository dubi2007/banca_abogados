'use client';

import {
  ArrowLeft,
  Download,
  FolderInput,
  Forward,
  Loader2,
  Mail,
  Paperclip,
  Printer,
  Reply,
  ReplyAll,
  Trash2,
} from 'lucide-react';
import type { Language } from '../../../utils/i18n';
import {
  formatBytes,
  formatFullDate,
  getFolderLabel,
  printEmailMessage,
  sanitizeEmailHtml,
} from './helpers';
import type { ImapFolder, ImapMessageDetail } from './types';

type Props = {
  lang: Language;
  selectedUid: number | null;
  loadingMessage: boolean;
  selectedMessage: ImapMessageDetail | null;
  selectedThread: ImapMessageDetail[];
  folders: ImapFolder[];
  activeFolder: string;
  onCloseReader: () => void;
  onReply: (detail: ImapMessageDetail) => void;
  onReplyAll: (detail: ImapMessageDetail) => void;
  onForward: (detail: ImapMessageDetail) => void;
  onMoveMessage: (uid: number, targetFolder: string) => void;
  onMarkUnread: (uid: number) => void;
  onDeleteMessage: (uid: number) => void;
};

export default function WebmailMessageReader({
  lang,
  selectedUid,
  loadingMessage,
  selectedMessage,
  selectedThread,
  folders,
  activeFolder,
  onCloseReader,
  onReply,
  onReplyAll,
  onForward,
  onMoveMessage,
  onMarkUnread,
  onDeleteMessage,
}: Props) {
  const english = lang === 'en';

  if (selectedUid === null) {
    return (
      <div className="flex flex-col bg-paper">
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
      </div>
    );
  }

  if (loadingMessage) {
    return (
      <div className="flex flex-col bg-paper">
        <div className="flex flex-1 items-center justify-center p-12 text-xs text-ink-muted">
          <Loader2 size={20} className="mr-2.5 animate-spin text-gold-dark" />
          <span>
            {english ? 'Loading message content...' : 'Descargando contenido del correo...'}
          </span>
        </div>
      </div>
    );
  }

  if (!selectedMessage) {
    return <div className="flex flex-col bg-paper" />;
  }

  const threadList = selectedThread.length > 0 ? selectedThread : [selectedMessage];

  return (
    <div
      role="region"
      aria-label={english ? 'Message reader' : 'Lector de correo'}
      tabIndex={0}
      className="flex min-w-0 flex-col bg-paper focus-visible:outline-offset-[-2px] lg:min-h-0 lg:overflow-y-auto"
    >
      <article className="flex flex-1 flex-col">
        {/* Reader Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-parchment/50 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={onCloseReader}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gold-dark hover:text-ink lg:hidden"
          >
            <ArrowLeft size={15} />
            <span>{english ? 'Back to list' : 'Volver a la lista'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onReply(selectedMessage)}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
            >
              <Reply size={14} />
              <span>{english ? 'Reply' : 'Responder'}</span>
            </button>
            <button
              type="button"
              onClick={() => onReplyAll(selectedMessage)}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
            >
              <ReplyAll size={14} />
              <span>{english ? 'Reply All' : 'Responder a todos'}</span>
            </button>
            <button
              type="button"
              onClick={() => onForward(selectedMessage)}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
            >
              <Forward size={14} />
              <span>{english ? 'Forward' : 'Reenviar'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
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
                    onMoveMessage(selectedMessage.uid, e.target.value);
                  }
                }}
                className="min-h-8 cursor-pointer border border-line bg-paper py-1 pr-2 pl-7 text-xs font-medium text-ink hover:border-gold-dark focus:outline-none"
              >
                <option value="">{english ? 'Move to...' : 'Mover a...'}</option>
                {folders
                  .filter((f) => f.path !== activeFolder)
                  .map((f) => (
                    <option key={f.path} value={f.path}>
                      {getFolderLabel(f, english)}
                    </option>
                  ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => onMarkUnread(selectedMessage.uid)}
              title={english ? 'Mark as unread' : 'Marcar como no leído'}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
            >
              <Mail size={14} />
              <span className="hidden xl:inline">{english ? 'Unread' : 'No leído'}</span>
            </button>

            <button
              type="button"
              onClick={() => printEmailMessage(selectedMessage, lang)}
              title={english ? 'Print message' : 'Imprimir correo'}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
            >
              <Printer size={14} />
            </button>

            <button
              type="button"
              onClick={() => onDeleteMessage(selectedMessage.uid)}
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
              <span className="font-semibold text-ink">{english ? 'From:' : 'De:'}</span>{' '}
              {selectedMessage.from}
            </p>
            {selectedMessage.to && (
              <p>
                <span className="font-semibold text-ink">{english ? 'To:' : 'Para:'}</span>{' '}
                {selectedMessage.to}
              </p>
            )}
            {selectedMessage.cc && (
              <p>
                <span className="font-semibold text-ink">CC:</span> {selectedMessage.cc}
              </p>
            )}
            {selectedMessage.date && (
              <p>
                <span className="font-semibold text-ink">{english ? 'Date:' : 'Fecha:'}</span>{' '}
                {formatFullDate(selectedMessage.date, lang)}
              </p>
            )}
          </div>

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
                    <span className="max-w-48 truncate font-medium">{att.filename}</span>
                    <span className="text-[11px] text-ink-muted">
                      ({formatBytes(att.size)})
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Email Body / Full Conversation Thread */}
        <div className="flex-1 space-y-5 px-5 py-6 sm:px-7">
          {threadList.length > 1 && (
            <div className="flex items-center justify-between border-b border-line pb-2 text-xs text-ink-muted">
              <span className="font-semibold tracking-wider text-gold-dark uppercase">
                {english
                  ? `Conversation thread (${threadList.length} messages)`
                  : `Hilo de conversación (${threadList.length} mensajes)`}
              </span>
            </div>
          )}
          {threadList.map((msgItem, idx) => (
            <div
              key={`${msgItem.folder || 'msg'}-${msgItem.uid}-${idx}`}
              className={`border p-4 sm:p-5 ${
                msgItem.isOutgoing
                  ? 'border-gold/50 bg-parchment/55'
                  : 'border-line bg-paper'
              }`}
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
                      msgItem.isOutgoing
                        ? 'bg-gold-dark text-white'
                        : 'bg-ink text-white'
                    }`}
                  >
                    {msgItem.isOutgoing
                      ? english
                        ? 'Sent by you'
                        : 'Enviado por ti'
                      : english
                        ? 'Received'
                        : 'Recibido'}
                  </span>
                  <span className="font-semibold text-ink">{msgItem.from}</span>
                  {msgItem.to && (
                    <span className="text-ink-muted">&rarr; {msgItem.to}</span>
                  )}
                </div>
                <time className="text-[11px] text-ink-muted">
                  {formatFullDate(msgItem.date, lang)}
                </time>
              </div>

              {msgItem.attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2 border-b border-line pb-3">
                  {msgItem.attachments.map((att, aIdx) => (
                    <a
                      key={`${att.filename}-${aIdx}`}
                      href={`data:${att.contentType};base64,${att.contentBase64}`}
                      download={att.filename}
                      className="inline-flex items-center gap-2 border border-line bg-parchment px-3 py-1.5 text-xs text-ink hover:border-gold-dark hover:text-gold-dark"
                    >
                      <Download size={13} />
                      <span className="max-w-48 truncate font-medium">{att.filename}</span>
                      <span className="text-[11px] text-ink-muted">
                        ({formatBytes(att.size)})
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {msgItem.html ? (
                <div
                  className="prose max-w-none text-sm leading-relaxed text-ink [&_a]:text-gold-dark [&_a]:underline [&_img]:max-w-full"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeEmailHtml(msgItem.html),
                  }}
                />
              ) : (
                <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-ink">
                  {msgItem.text ||
                    (english
                      ? '(No text content)'
                      : '(Mensaje sin contenido de texto)')}
                </pre>
              )}
            </div>
          ))}
        </div>

        {/* Quick Bottom Reply / Reply All / Forward Bar */}
        <footer className="flex flex-wrap items-center gap-2.5 border-t border-line bg-parchment/40 px-5 py-3.5 sm:px-7">
          <button
            type="button"
            onClick={() => onReply(selectedMessage)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-paper px-4 py-1.5 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
          >
            <Reply size={14} />
            <span>{english ? 'Reply' : 'Responder'}</span>
          </button>
          <button
            type="button"
            onClick={() => onReplyAll(selectedMessage)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-paper px-4 py-1.5 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
          >
            <ReplyAll size={14} />
            <span>{english ? 'Reply to All' : 'Responder a todos'}</span>
          </button>
          <button
            type="button"
            onClick={() => onForward(selectedMessage)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-paper px-4 py-1.5 text-xs font-medium text-ink hover:border-gold-dark hover:text-gold-dark"
          >
            <Forward size={14} />
            <span>{english ? 'Forward' : 'Reenviar'}</span>
          </button>
        </footer>
      </article>
    </div>
  );
}
