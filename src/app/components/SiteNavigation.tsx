'use client';

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
    <nav
      className="navbar container"
      aria-label={lang === 'en' ? 'Main navigation' : 'Navegación principal'}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && expanded) {
          setExpanded(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className="logo">
        <Link href={`/${lang}/`} onClick={() => setExpanded(false)}>
          <img src="/images/intro/logo_fondo_transparente.png" alt="" className="header-logo" />
          <span className="brand-name">FAYNSHTEYN</span>
        </Link>
      </div>
      <button
        ref={toggle}
        className="mobile-toggle"
        type="button"
        aria-label={lang === 'en' ? 'Menu' : 'Menú'}
        aria-expanded={expanded}
        aria-controls="main-navigation"
        onClick={() => setExpanded(!expanded)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      <ul id="main-navigation" className={expanded ? 'nav-links open' : 'nav-links'}>
        {links.map(({ path, label }) => {
          const href = `/${lang}/${path}`;
          return (
            <li key={path}>
              <Link href={href} aria-current={pathname === href ? 'page' : undefined}
                onClick={() => setExpanded(false)}>{label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
