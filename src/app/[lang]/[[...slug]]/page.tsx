import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import areas from '../../../data/areas.json';
import directory from '../../../data/directorio.json';
import about from '../../../data/about.json';
import news from '../../../data/novedades.json';
import contact from '../../../data/contact.json';
import products from '../../../data/productos.json';
import sedes from '../../../data/sedes.json';
import es from '../../../data/es.json';
import en from '../../../data/en.json';
import DirectoryFilters from '../../components/DirectoryFilters';
import NewsTabs from '../../components/NewsTabs';
import ContactForm from '../../components/ContactForm';
import PageHero from '../../components/PageHero';
import ServiceIcon from '../../components/ServiceIcon';
import WebmailClient from '../../components/WebmailClient';
import type { Language } from '../../../utils/i18n';
import HomePage from './HomePage';
import PracticeAreas from './PracticeAreas';

type Props = { params: Promise<{ lang: string; slug?: string[] }> };
const langs = ['es', 'en'] as const;
const paths = ['', 'areas', 'nosotros', 'sedes', 'directorio', 'productos-legales', 'novedades', 'contactenos', 'webmail'];

export function generateStaticParams() {
  const result: { lang: Language; slug: string[] }[] = [];
  for (const lang of langs) {
    for (const path of paths) result.push({ lang, slug: path ? [path] : [] });
    for (const area of areas[lang].items) result.push({ lang, slug: ['areas', area.id] });
    for (const member of directory.members) result.push({ lang, slug: ['directorio', member.id] });
  }
  return result;
}

export default async function RoutePage({ params }: Props) {
  const { lang: language, slug = [] } = await params;
  if (language !== 'es' && language !== 'en') notFound();

  const t = language === 'en' ? en : es;
  const [section, id] = slug;
  if (slug.length > 2 || (id && section !== 'areas' && section !== 'directorio')) notFound();
  if (!section) return <HomePage lang={language} t={t} />;

  if (section === 'areas') {
    return <PracticeAreas lang={language} id={id} subtitle={t['header.subtitle.areas']} />;
  }

  if (section === 'directorio') {
    if (id) {
      const member = directory.members.find((item) => item.id === id);
      if (!member) notFound();
      return <MemberProfile member={member} language={language} />;
    }

    return (
      <>
        <PageHero title={t['nav.directory']} subtitle={t['header.subtitle.directory']} image="/images/estudio/despacho-ejecutivo.webp" />
        <DirectoryFilters data={directory} lang={language} />
      </>
    );
  }

  if (section === 'novedades') {
    return (
      <>
        <PageHero title={news[language].title} subtitle={t['header.subtitle.news']} image="/images/headers/novedades.webp" />
        <NewsTabs data={news[language]} lang={language} />
      </>
    );
  }

  if (section === 'contactenos') return <ContactPage language={language} t={t} />;
  if (section === 'nosotros') return <AboutPage language={language} t={t} />;
  if (section === 'sedes') return <OfficeList language={language} />;
  if (section === 'productos-legales') return <LegalProducts language={language} contactLabel={t['nav.contact']} />;
  if (section === 'webmail') return <WebmailClient lang={language} />;
  notFound();
}

function MemberProfile({ member, language }: { member: (typeof directory.members)[number]; language: Language }) {
  const english = language === 'en';

  return (
    <div className="site-container pt-2 pb-12 sm:pb-16">
      <Link href={`/${language}/directorio`} className="text-link mb-4">
        <ArrowLeft aria-hidden="true" size={18} />
        {english ? 'Back to directory' : 'Volver al directorio'}
      </Link>
      <div className="card-surface grid gap-7 p-5 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-center sm:p-8">
        <Image
          src={member.image}
          alt={member.name}
          width={1280}
          height={1728}
          sizes="(min-width: 640px) 256px, (min-width: 400px) 288px, 75vw"
          className="w-full max-w-72"
          priority
        />
        <div className="min-w-0">
          <h1 className="section-heading [overflow-wrap:anywhere]">{member.name}</h1>
          <p className="mt-3 font-medium text-gold-dark">{member.role[language]}</p>
          <a className="text-link mt-3 [overflow-wrap:anywhere]" href={`mailto:${member.email}`}>{member.email}</a>
        </div>
      </div>
      <section className="mt-8 max-w-3xl">
        <h2 className="section-heading">{english ? 'Experience' : 'Experiencia'}</h2>
        <p className="mt-4 leading-relaxed whitespace-pre-line">{member.experience[language]}</p>
      </section>
    </div>
  );
}

function ContactPage({ language, t }: { language: Language; t: typeof es }) {
  const data = contact[language];
  const { address, email, phone } = data.info;

  return (
    <>
      <PageHero title={data.title} subtitle={data.subtitle} image="/images/estudio/recepcion.webp" />
      <div className="site-container grid items-start gap-6 py-10 sm:py-14 lg:grid-cols-[1fr_1.5fr] lg:gap-8">
        <section className="card-surface p-6 sm:p-8">
          <h2 className="text-2xl leading-tight">{language === 'en' ? 'Contact information' : 'Información de contacto'}</h2>
          <address className="mt-4 grid gap-4 text-sm not-italic">
            <p>{address}</p>
            <a className="text-gold-dark underline-offset-4 hover:underline" href={`tel:${phone.replace(/[^+\d]/g, '')}`}>
              <span className="mr-2 text-xs font-semibold">{t['contact.label.phone']}</span>
              {phone}
            </a>
            <a className="text-gold-dark underline-offset-4 hover:underline [overflow-wrap:anywhere]" href={`mailto:${email}`}>{email}</a>
          </address>
        </section>
        <ContactForm language={language} labels={data.form} />
      </div>
    </>
  );
}

function AboutPage({ language, t }: { language: Language; t: typeof es }) {
  const facilities = about.instalaciones[language];

  return (
    <>
      <PageHero title={t['nav.about']} subtitle={t['header.subtitle.about']} image="/images/estudio/sala-directorio.webp" />
      <section className="site-container py-10 sm:py-14">
        <h2 className="section-heading">Faynshteyn Abogados &amp; Consultores</h2>
        <p className="mt-4 max-w-4xl leading-relaxed">{about.historia[language]}</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {[about.mision[language], about.vision[language]].map(({ title, text }) => (
            <article className="border-t border-gold-dark py-5" key={title}>
              <h3 className="text-2xl leading-tight">{title}</h3>
              <p className="mt-3 leading-relaxed">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="about-facilities" className="border-t border-line bg-parchment py-10 sm:py-14">
        <div className="site-container">
          <h2 id="about-facilities" className="section-heading">{facilities.title}</h2>
          <p className="mt-2 max-w-2xl leading-relaxed">{facilities.subtitle}</p>
          <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {facilities.items.map(({ src, title, caption }) => (
              <figure key={src} className="card-surface flex flex-col overflow-hidden">
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-line">
                  <Image
                    src={src}
                    alt={title}
                    fill
                    sizes="(min-width: 1024px) 380px, (min-width: 640px) 48vw, 100vw"
                    className="object-cover object-center"
                  />
                </div>
                <figcaption className="border-t border-line p-4 sm:p-5">
                  <h3 className="text-lg leading-snug text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed">{caption}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function OfficeList({ language }: { language: Language }) {
  const data = sedes[language];

  return (
    <>
      <PageHero title={data.title} subtitle={data.subtitle} image="/images/estudio/sala-conferencias.webp" />
      <div className="site-container py-10 sm:py-14">
        <div className="grid gap-5 sm:grid-cols-2">
          {data.items.map(({ city, address, phone, email, mapUrl, image }) => {
            const directions = new URL(mapUrl);
            directions.pathname = '/maps/search/';
            directions.searchParams.set('api', '1');
            directions.searchParams.set('query', address);
            return (
              <article className="card-surface flex flex-col overflow-hidden" key={city}>
                {image && (
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-line">
                    <Image
                      src={image}
                      alt={city}
                      fill
                      sizes="(min-width: 640px) 48vw, 100vw"
                      className="object-cover object-center"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col items-start p-5 sm:p-7">
                  <MapPin aria-hidden="true" size={24} className="mb-4 text-gold-dark" />
                  <h2 className="text-2xl leading-snug">{city}</h2>
                  <address className="mt-3 mb-4 space-y-2 text-sm not-italic">
                    <p>{address}</p>
                    <p><a className="hover:underline" href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a></p>
                    <p><a className="hover:underline [overflow-wrap:anywhere]" href={`mailto:${email}`}>{email}</a></p>
                  </address>
                  <a className="text-link mt-auto" href={directions.href}>
                    {language === 'en' ? 'View on map' : 'Ver en el mapa'}
                    <ArrowUpRight aria-hidden="true" size={18} />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}

function LegalProducts({ language, contactLabel }: { language: Language; contactLabel: string }) {
  const data = products[language];
  const english = language === 'en';
  const columns = 'md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.5fr)_minmax(0,0.6fr)] md:gap-6 lg:gap-10';

  return (
    <>
      <PageHero title={data.title} subtitle={data.subtitle} image="/images/headers/productos-legales.webp">
        <Link className="button-primary" href={`/${language}/contactenos`}>
          {contactLabel}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </PageHero>
      <div className="site-container py-10 sm:py-14">
        <div aria-hidden="true" className={`hidden pb-3 text-xs font-medium tracking-wider text-ink-muted uppercase md:grid ${columns}`}>
          <span>{english ? 'Product' : 'Producto'}</span>
          <span>{english ? 'Scope' : 'Alcance'}</span>
          <span className="text-right">{english ? 'Engagement' : 'Contratación'}</span>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {data.items.map(({ title, description, price, priceOnRequest, icon }) => (
            <li className={`grid items-start gap-2.5 py-5 md:py-7 ${columns}`} key={title}>
              <div className="flex items-start gap-3">
                <ServiceIcon name={icon} />
                <h2 className="text-xl leading-snug sm:text-2xl">{title}</h2>
              </div>
              <p className="pl-8 text-sm leading-relaxed md:pt-1 md:pl-0">{description}</p>
              <div className="pl-8 text-sm md:pt-1 md:pl-0 md:text-right">
                {priceOnRequest ? (
                  <Link
                    href={`/${language}/contactenos`}
                    aria-label={english ? `Contact us about ${title}` : `Consultar por ${title}`}
                    className="inline-flex min-h-11 items-center gap-1.5 text-gold-dark underline underline-offset-4 hover:text-ink md:min-h-6"
                  >
                    {price}
                    <ArrowRight aria-hidden="true" size={15} strokeWidth={1.5} />
                  </Link>
                ) : <p className="font-medium text-ink">{price}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
