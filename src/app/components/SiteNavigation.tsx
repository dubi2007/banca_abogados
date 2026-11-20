'use client';

import { ArrowRight, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import type { Language } from '../../utils/i18n';

type SiteNavigationProps = {
  lang: Language;
  links: { path: string; label: string }[];
};

export default function SiteNavigation({ lang, links }: SiteNavigationProps) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  return (
    <div
      className="site-container flex min-h-[4.5rem] items-center justify-between gap-1.5 sm:gap-3 xl:min-h-20 xl:gap-5"
      onBlur={(event) => {
        if (expanded && !event.currentTarget.contains(event.relatedTarget)) {
          setExpanded(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && expanded) {
          setExpanded(false);
          toggle.current?.focus();
        }
      }}
    >
      <Link
        href={`/${lang}/`}
        className="flex min-h-11 shrink-0 items-center gap-2 hover:text-gold-dark sm:gap-3"
        onClick={() => setExpanded(false)}
      >
        <Image
          src="/images/intro/logo_fondo_transparente.png"
          alt=""
          width={48}
          height={42}
          unoptimized
          className="h-auto w-9 sm:w-12"
        />
        <span>
          <span className="block font-serif text-sm leading-tight tracking-[0.07em] sm:text-lg">FAYNSHTEYN</span>
          <span className="mt-1 hidden text-[0.53rem] font-medium tracking-widest text-ink-muted uppercase min-[375px]:block">
            {lang === 'en' ? 'Lawyers & Consultants' : 'Abogados & Consultores'}
          </span>
        </span>
      </Link>
      <button
        ref={toggle}
        className="order-last grid size-11 shrink-0 cursor-pointer place-items-center border border-line hover:border-gold-dark hover:text-gold-dark lg:hidden"
        type="button"
        aria-label={lang === 'en' ? 'Menu' : 'Menú'}
        aria-expanded={expanded}
        aria-controls="main-navigation"
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
      </button>
      <nav
        id="main-navigation"
        aria-label={lang === 'en' ? 'Main navigation' : 'Navegación principal'}
        className={`${expanded ? 'block' : 'hidden'} absolute inset-x-0 top-full max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain border-y border-line bg-paper lg:static lg:ml-auto lg:block lg:max-h-none lg:overflow-visible lg:border-0`}
      >
        <ul className="px-5 pt-1 pb-4 sm:px-8 lg:flex lg:items-center lg:gap-3 lg:p-0 xl:gap-5">
          {links.map(({ path, label }) => {
            const href = `/${lang}/${path}`;
            const current = pathname === href ? 'page' : pathname.startsWith(`${href}/`) ? 'location' : undefined;

            return (
              <li key={path}>
                <Link
                  href={href}
                  aria-current={current}
                  className={path === 'contactenos'
                    ? 'mt-3 inline-flex min-h-11 items-center gap-3 bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-gold-dark lg:mt-0 lg:px-3 xl:px-4'
                    : 'flex min-h-11 items-center border-b border-line text-sm font-medium text-ink transition-colors hover:text-gold-dark lg:border-0 [&[aria-current]]:text-gold-dark [&[aria-current]]:underline [&[aria-current]]:underline-offset-[0.4em]'}
                  onClick={() => setExpanded(false)}
                >
                  {label}
                  {path === 'contactenos' && <ArrowRight aria-hidden="true" size={15} strokeWidth={1.5} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div role="group" className="ml-auto flex shrink-0 items-center text-xs font-semibold lg:ml-0 lg:border-l lg:border-line lg:pl-2 xl:pl-4" aria-label={lang === 'en' ? 'Language' : 'Idioma'}>
        {(['es', 'en'] as const).map((option) => (
          <Link
            key={option}
            href={pathname.replace(/^\/(?:es|en)(?=\/|$)/, `/${option}`)}
            hrefLang={option}
            lang={option}
            aria-label={option === 'es' ? 'Español' : 'English'}
            aria-current={option === lang ? 'true' : undefined}
            className="grid min-h-11 min-w-7 place-items-center text-ink-muted hover:text-gold-dark aria-current:text-gold-dark aria-current:underline aria-current:underline-offset-4"
            onClick={() => setExpanded(false)}
          >
            {option.toUpperCase()}
          </Link>
        ))}
      </div>
    </div>
  );
}
