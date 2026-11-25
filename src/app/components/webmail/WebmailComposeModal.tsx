'use client';

import {
  AlertCircle,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CheckCircle2,
  Eraser,
  FileSignature,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  PenSquare,
  Quote,
  Save,
  Send,
  Strikethrough,
  Underline,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Language } from '../../../utils/i18n';
import {
  formatBytes,
  getCorporateSignatureHtml,
  htmlToPlainText,
} from './helpers';
import type { ComposeMode, ComposeNotice, ImapAttachment } from './types';

type Props = {
  lang: Language;
  sessionEmail: string;
  mode: ComposeMode;
  initialTo: string;
  initialCc: string;
  initialSubject: string;
  initialHtml: string;
  initialAttachments: ImapAttachment[];
  inReplyTo?: string;
  onClose: () => void;
  onSent: () => void;
};

export default function WebmailComposeModal({
  lang,
  sessionEmail,
  mode,
  initialTo,
  initialCc,
  initialSubject,
  initialHtml,
  initialAttachments,
  inReplyTo,
  onClose,
  onSent,
}: Props) {
  const english = lang === 'en';

  const [composeTo, setComposeTo] = useState(initialTo);
  const [composeCc, setComposeCc] = useState(initialCc);
  const [composeBcc, setComposeBcc] = useState('');
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState(initialSubject);
  const [composeAttachments, setComposeAttachments] =
    useState<ImapAttachment[]>(initialAttachments);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [composeNotice, setComposeNotice] = useState<ComposeNotice | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = initialHtml;
        editorRef.current.focus();
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [initialHtml]);

  const composeTitle = () => {
    if (mode === 'reply') return english ? 'Reply to Message' : 'Responder Correo';
    if (mode === 'replyAll') return english ? 'Reply to All' : 'Responder a Todos';
    if (mode === 'forward') return english ? 'Forward Message' : 'Reenviar Correo';
    return english ? 'Compose Corporate Email' : 'Redactar Correo Corporativo';
  };

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
    document.execCommand('insertHTML', false, getCorporateSignatureHtml(sessionEmail));
  };

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
          inReplyTo,
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
          inReplyTo,
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
      onSent();
      setTimeout(() => {
        onClose();
      }, 900);
    } catch {
      setComposeNotice({
        type: 'err',
        text: english
          ? 'Network error sending message.'
          : 'Error de red al enviar el correo.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
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
        <div className="flex items-center justify-between border-b border-line bg-ink-deep px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <PenSquare size={17} className="text-gold" />
            <h2 id="compose-modal-title" className="font-serif text-lg text-white">
              {composeTitle()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
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

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={english ? 'Email message body' : 'Cuerpo del correo'}
            className="min-h-60 flex-1 overflow-y-auto border border-line bg-paper p-4 text-sm leading-relaxed text-ink focus:border-gold-dark focus:outline-none [&_a]:text-gold-dark [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gold [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          />

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
                      <span className="max-w-44 truncate font-medium">{att.filename}</span>
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
                onClick={onClose}
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
  );
}
