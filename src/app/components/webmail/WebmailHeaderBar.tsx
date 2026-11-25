'use client';

import { ArrowLeft, LogOut, PenSquare, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { Language } from '../../../utils/i18n';

type Props = {
  lang: Language;
  sessionEmail: string;
  totalCount: number;
  unseenCount: number;
  loadingMailbox: boolean;
  onCompose: () => void;
  onRefresh: () => void;
  onLogout: () => void;
};

export default function WebmailHeaderBar({
  lang,
  sessionEmail,
  totalCount,
  unseenCount,
  loadingMailbox,
  onCompose,
  onRefresh,
  onLogout,
}: Props) {
  const english = lang === 'en';

  return (
    <div className="on-dark mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-deep px-4 py-3 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-block size-2.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="font-sans text-sm font-medium text-white [overflow-wrap:anywhere]">{sessionEmail}</h1>
          <p className="text-[11px] text-white/65 [overflow-wrap:anywhere]">
            {totalCount}{' '}
            {english ? 'messages' : 'mensajes'} ({unseenCount}{' '}
            {english ? 'unread' : 'sin leer'})
          </p>
          <Link
            href={`/${lang}/webmail/recuperacion#correo-alternativo`}
            className="mt-1 inline-flex min-h-9 items-center text-xs font-medium text-gold underline-offset-4 hover:underline"
          >
            {english ? 'Recovery email' : 'Correo de recuperación'}
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/${lang}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:border-gold hover:text-gold"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          {english ? 'Back to the website' : 'Volver al sitio'}
        </Link>
        <button
          type="button"
          onClick={onCompose}
          className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink-deep transition-colors hover:bg-white"
        >
          <PenSquare size={15} />
          <span>{english ? 'Compose' : 'Redactar'}</span>
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loadingMailbox}
          title={english ? 'Refresh folder' : 'Actualizar bandeja'}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:border-gold hover:text-gold disabled:opacity-50"
        >
          <RefreshCw size={14} className={loadingMailbox ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{english ? 'Refresh' : 'Actualizar'}</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:border-red-400 hover:text-red-300"
        >
          <LogOut size={14} />
          <span>{english ? 'Sign out' : 'Salir'}</span>
        </button>
      </div>
    </div>
  );
}
