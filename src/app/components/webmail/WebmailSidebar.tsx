'use client';

import {
  FileText,
  Folder,
  Inbox,
  PenSquare,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type { Language } from '../../../utils/i18n';
import { getFolderLabel } from './helpers';
import type { ImapFolder } from './types';

type Props = {
  lang: Language;
  folders: ImapFolder[];
  activeFolder: string;
  onSelectFolder: (folderPath: string) => void;
  onCompose: () => void;
};

function getFolderIcon(folder: ImapFolder) {
  if (folder.specialUse === 'inbox') return <Inbox size={17} aria-hidden="true" />;
  if (folder.specialUse === 'sent') return <Send size={17} aria-hidden="true" />;
  if (folder.specialUse === 'drafts') return <FileText size={17} aria-hidden="true" />;
  if (folder.specialUse === 'junk') return <ShieldAlert size={17} aria-hidden="true" />;
  if (folder.specialUse === 'trash') return <Trash2 size={17} aria-hidden="true" />;
  return <Folder size={17} aria-hidden="true" />;
}

export default function WebmailSidebar({
  lang,
  folders,
  activeFolder,
  onSelectFolder,
  onCompose,
}: Props) {
  const english = lang === 'en';

  return (
    <aside className="min-w-0 border-b border-line bg-parchment/60 p-3 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
      <button
        type="button"
        onClick={onCompose}
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
                onClick={() => onSelectFolder(folder.path)}
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
                  <span className="truncate">{getFolderLabel(folder, english)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {(folder.unseen ?? 0) > 0 ? (
                    <span className="rounded-xs bg-gold-dark px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {folder.unseen}
                    </span>
                  ) : (folder.total ?? 0) > 0 ? (
                    <span className="text-[10px] text-ink-muted">{folder.total}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
