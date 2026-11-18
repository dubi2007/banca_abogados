import type { Metadata } from 'next';
import Link from 'next/link';
import es from '../../data/es.json';
import en from '../../data/en.json';
import SiteNavigation from '../components/SiteNavigation';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Faynshteyn Abogados',
  description: 'Faynshteyn Abogados & Consultores',
};

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: routeLanguage } = await params;
  const lang = routeLanguage === 'en' ? 'en' : 'es';
  const t = lang === 'en' ? en : es;
  const links = [
    { path: 'nosotros', label: t['nav.about'] },
    { path: 'areas', label: t['nav.areas'] },
    { path: 'sedes', label: t['nav.locations'] },
    { path: 'directorio', label: t['nav.directory'] },
    { path: 'productos-legales', label: t['nav.products'] },
    { path: 'novedades', label: t['nav.news'] },
    { path: 'contactenos', label: t['nav.contact'] },
  ];

  return (
    <html lang={lang}>
      <body>
        <header className="main-header" id="mainHeader">
          <div className="top-bar container">
            <div className="lang-selector">
              <Link href="/es/" hrefLang="es" lang="es" aria-label="Español"
                className={lang === 'es' ? 'active' : undefined}>ES</Link>
              <span aria-hidden="true">|</span>
              <Link href="/en/" hrefLang="en" lang="en" aria-label="English"
                className={lang === 'en' ? 'active' : undefined}>EN</Link>
            </div>
          </div>
          <SiteNavigation lang={lang} links={links} />
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container">
            <p>{t['footer.description']}</p>
            <small>{t['footer.copyright']}</small>
          </div>
        </footer>
      </body>
    </html>
  );
}
