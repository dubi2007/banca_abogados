import { MessageCircle } from 'lucide-react';
import type { Language } from '../../utils/i18n';

type Props = {
  lang: Language;
  href: string;
};

export default function FloatingWhatsApp({ lang, href }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={lang === 'en' ? 'Write to us on WhatsApp' : 'Escríbanos por WhatsApp'}
      className="whatsapp-float fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-[#087947] px-3.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#065c36] focus-visible:ring-2 focus-visible:ring-white sm:px-4"
    >
      <MessageCircle aria-hidden="true" size={22} />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
