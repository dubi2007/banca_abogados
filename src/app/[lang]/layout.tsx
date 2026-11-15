import Link from 'next/link';
import es from '../../data/es.json';
import en from '../../data/en.json';

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{lang: string}> }) {
  const { lang } = await params;
  const t = lang === 'en' ? en : es;
  return <><header className="main-header" id="mainHeader"><div className="top-bar container"><div className="lang-selector"><Link href="/es/" className={lang === 'es' ? 'active' : ''}>ES</Link><span> | </span><Link href="/en/" className={lang === 'en' ? 'active' : ''}>EN</Link></div></div><nav className="navbar container"><div className="logo"><Link href={`/${lang}/`}><img src="/images/intro/logo_fondo_transparente.png" alt="Logo Faynshteyn" className="header-logo"/><span className="brand-name">FAYNSHTEYN</span></Link></div><ul className="nav-links"><li><Link href={`/${lang}/nosotros`}>{t['nav.about']}</Link></li><li><Link href={`/${lang}/areas`}>{t['nav.areas']}</Link></li><li><Link href={`/${lang}/sedes`}>{t['nav.locations']}</Link></li><li><Link href={`/${lang}/directorio`}>{t['nav.directory']}</Link></li><li><Link href={`/${lang}/productos-legales`}>{t['nav.products']}</Link></li><li><Link href={`/${lang}/novedades`}>{t['nav.news']}</Link></li><li><Link href={`/${lang}/contactenos`}>{t['nav.contact']}</Link></li></ul></nav></header>{children}<footer className="site-footer"><div className="container"><p>{t['footer.description']}</p><small>{t['footer.copyright']}</small></div></footer></>;
}
