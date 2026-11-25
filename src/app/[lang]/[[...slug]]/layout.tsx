import Link from 'next/link';
import contact from '../../../data/contact.json';
import es from '../../../data/es.json';
import en from '../../../data/en.json';
import { buildWhatsAppHref } from '../../../utils/contact';
import FirmIntro from '../../components/FirmIntro';
import FloatingWhatsApp from '../../components/FloatingWhatsApp';
import SiteNavigation from '../../components/SiteNavigation';

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: routeLanguage } = await params;
  const lang = routeLanguage === 'en' ? 'en' : 'es';
  const t = lang === 'en' ? en : es;
  const { email, phone, socials } = contact.channels;
  const phoneNumber = phone.replace(/\D/g, '');
  const whatsappHref = buildWhatsAppHref(phone, contact[lang].whatsappMessage);
  const links = [
    { path: 'nosotros', label: t['nav.about'] },
    { path: 'areas', label: t['nav.areas'] },
    { path: 'sedes', label: t['nav.locations'] },
    { path: 'directorio', label: t['nav.directory'] },
    { path: 'productos-legales', label: t['nav.products'] },
    { path: 'novedades', label: t['nav.news'] },
    { path: 'webmail', label: t['nav.webmail'] },
    { path: 'contactenos', label: t['nav.contact'] },
  ];

  return (
    <>
      <FirmIntro lang={lang} />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-white focus:px-4 focus:py-2 focus:text-ink"
      >
        {lang === 'en' ? 'Skip to content' : 'Saltar al contenido'}
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper text-ink">
        <SiteNavigation lang={lang} links={links} />
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 scroll-mt-20">
        {children}
      </main>
      <FloatingWhatsApp lang={lang} href={whatsappHref} />
      <footer className="on-dark border-t-2 border-gold bg-ink-deep text-white">
        <div className="site-container">
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 py-10 sm:py-14 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-8">
            <div className="col-span-2 md:col-span-1">
              <p className="font-serif text-2xl">Faynshteyn</p>
              <p className="mt-1 text-xs tracking-widest text-gold uppercase">
                {lang === 'en' ? 'Lawyers & Consultants' : 'Abogados & Consultores'}
              </p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">{t['footer.description']}</p>
              <address className="mt-4 text-sm not-italic text-white/85">
                <a className="inline-block py-2.5 underline-offset-4 [overflow-wrap:anywhere] hover:text-gold hover:underline" href={`mailto:${email}`}>
                  {email}
                </a>
                <div className="flex flex-wrap items-center gap-x-5">
                  <a className="inline-flex min-h-11 items-center hover:text-gold" href={`tel:+${phoneNumber}`}>{phone}</a>
                  <a
                    className="inline-flex min-h-11 items-center hover:text-gold"
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                </div>
              </address>
            </div>
            <nav aria-label={t['footer.services']}>
              <p className="text-xs font-semibold tracking-widest text-gold">{t['footer.services']}</p>
              <ul className="mt-2 text-sm">
                <li><Link className="inline-flex min-h-11 items-center hover:text-gold" href={`/${lang}/areas`}>{t['nav.areas']}</Link></li>
                <li><Link className="inline-flex min-h-11 items-center hover:text-gold" href={`/${lang}/productos-legales`}>{t['nav.products']}</Link></li>
              </ul>
            </nav>
            <nav aria-label={t['footer.nav']}>
              <p className="text-xs font-semibold tracking-widest text-gold">{t['footer.nav']}</p>
              <ul className="mt-2 text-sm">
                {links.filter(({ path }) => ['nosotros', 'sedes', 'contactenos', 'webmail'].includes(path)).map(({ path, label }) => (
                  <li key={path}>
                    <Link className="inline-flex min-h-11 items-center hover:text-gold" href={`/${lang}/${path}`}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="footer-bottom flex flex-wrap items-center justify-between gap-x-5 gap-y-1 border-t border-white/15 py-3">
            <p className="text-xs leading-relaxed text-white/70">{t['footer.copyright']}</p>
            <nav aria-label={lang === 'en' ? 'Social media' : 'Redes sociales'}>
              <ul className="flex flex-wrap gap-x-4 text-sm">
                {socials.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      className="inline-flex min-h-11 items-center text-white/85 hover:text-gold"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
