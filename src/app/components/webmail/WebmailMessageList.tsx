'use client';

import { Loader2, MailOpen, Search, Star } from 'lucide-react';
import type { Language } from '../../../utils/i18n';
import { extractSenderName, formatDate } from './helpers';
import type { FilterTab, ImapMessageSummary } from './types';

type Props = {
  lang: Language;
  messages: ImapMessageSummary[];
  selectedUid: number | null;
  loadingMailbox: boolean;
  searchQuery: string;
  filterTab: FilterTab;
  onSearchChange: (q: string) => void;
  onFilterTabChange: (tab: FilterTab) => void;
  onSelectMessage: (msg: ImapMessageSummary) => void;
  onToggleFlagged: (uid: number, flagged: boolean, e: React.MouseEvent) => void;
};

export default function WebmailMessageList({
  lang,
  messages,
  selectedUid,
  loadingMailbox,
  searchQuery,
  filterTab,
  onSearchChange,
  onFilterTabChange,
  onSelectMessage,
  onToggleFlagged,
}: Props) {
  const english = lang === 'en';

  const tabLabels: Record<FilterTab, string> = {
    all: english ? 'All' : 'Todos',
    unread: english ? 'Unread' : 'No leídos',
    starred: english ? 'Starred' : 'Destacados',
  };

  return (
    <div
      className={`min-w-0 flex-col border-b border-line lg:min-h-0 lg:border-r lg:border-b-0 ${
        selectedUid !== null ? 'hidden lg:flex' : 'flex'
      }`}
    >
      <div className="shrink-0 space-y-2 border-b border-line p-3">
        <div className="relative">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 left-3 text-ink-muted"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              english ? 'Search by sender or subject...' : 'Buscar por remitente o asunto...'
            }
            className="w-full border border-line bg-parchment/50 py-1.5 pr-3 pl-9 text-xs text-ink placeholder:text-ink-muted focus:border-gold-dark focus:bg-paper focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          {(['all', 'unread', 'starred'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onFilterTabChange(tab)}
              className={`cursor-pointer px-2.5 py-1 font-medium transition-colors ${
                filterTab === tab
                  ? 'bg-ink text-white'
                  : 'bg-parchment/70 text-ink-muted hover:text-ink'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      {loadingMailbox ? (
        <div className="flex flex-1 items-center justify-center p-10 text-xs text-ink-muted">
          <Loader2 size={18} className="mr-2 animate-spin text-gold-dark" />
          <span>{english ? 'Synchronizing messages...' : 'Sincronizando mensajes...'}</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-xs text-ink-muted">
          <MailOpen size={28} strokeWidth={1.3} className="mb-2 text-ink-muted/60" />
          <p>{english ? 'No messages match this view.' : 'No hay mensajes en esta vista.'}</p>
        </div>
      ) : (
        <ul className="min-h-0 max-h-[38rem] flex-1 divide-y divide-line overflow-y-auto lg:max-h-none">
          {messages.map((msg) => {
            const sender = extractSenderName(msg.from);
            const isSelected = selectedUid === msg.uid;
            return (
              <li key={msg.uid} className="relative">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectMessage(msg)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMessage(msg);
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
                        onClick={(e) => onToggleFlagged(msg.uid, !msg.flagged, e)}
                        aria-label={english ? 'Star message' : 'Destacar correo'}
                        className={`cursor-pointer ${
                          msg.flagged
                            ? 'text-gold-dark'
                            : 'text-ink-muted/40 hover:text-gold-dark'
                        }`}
                      >
                        <Star size={14} fill={msg.flagged ? 'currentColor' : 'none'} />
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
  );
}
