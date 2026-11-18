import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import areas from '../../../data/areas.json';
import directory from '../../../data/directorio.json';
import home from '../../../data/home.json';
import about from '../../../data/about.json';
import news from '../../../data/novedades.json';
import contact from '../../../data/contact.json';
import products from '../../../data/productos.json';
import sedes from '../../../data/sedes.json';
import es from '../../../data/es.json';
import en from '../../../data/en.json';
import SearchAreas from '../../components/SearchAreas';
import DirectoryFilters from '../../components/DirectoryFilters';
import NewsTabs from '../../components/NewsTabs';
import ContactForm from '../../components/ContactForm';
import type { Language } from '../../../utils/i18n';

type Props = { params: Promise<{ lang: string; slug?: string[] }> };
const langs = ['es', 'en'] as const;
const paths = ['', 'areas', 'nosotros', 'sedes', 'directorio', 'productos-legales', 'novedades', 'contactenos'];

export function generateStaticParams() {
  const result: { lang: Language; slug: string[] }[] = [];
  for (const lang of langs) {
    for (const path of paths) result.push({ lang, slug: path ? [path] : [] });
    for (const a of areas[lang].items) result.push({lang, slug:['areas', a.id]});
    for (const m of directory.members) result.push({lang, slug:['directorio', m.id]});
  }
  return result;
}

function Header({ title, subtitle, image }: {title:string;subtitle?:string;image?:string}) {
  return <div className="page-header" style={image ? {backgroundImage:`url('${image}')`} : undefined}><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>;
}
function Home({ lang, t }: { lang: Language; t: Record<string, string> }) {
  const featuredAreas = home.practice_areas[lang];
  const slide = home.hero.slides[0];
  const commitment = home.commitment[lang];

  return (
    <>
      <Header title={slide[lang].title} subtitle={slide[lang].subtitle} image={slide.image} />
      <section className="home-areas content-below-diagonal">
        <div className="container">
          <h2>{t['home.areas.title']}</h2>
          <p>{t['home.areas.subtitle']}</p>
          <div className="areas-grid">
            {featuredAreas.map(({ link, title }) => (
              <Link className="area-card" href={`/${lang}${link}`} key={link}>
                <h3>{title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="home-commitment">
        <div className="container">
          <h2>{commitment.title}</h2>
          {commitment.items.map(({ title }) => (
            <article key={title}><h3>{title}</h3></article>
          ))}
        </div>
      </section>
    </>
  );
}
export default async function RoutePage({params}: Props) {
  const { lang: language, slug = [] } = await params;
  if (language !== 'es' && language !== 'en') notFound();

  const t = language === 'en' ? en : es;
  const [section, id] = slug;
  if (slug.length > 2 || (id && section !== 'areas' && section !== 'directorio')) notFound();
  if (!section) return <Home lang={language} t={t}/>;
  if (section === 'areas') {
    const list = areas[language].items;
    const area = id ? list.find((item) => item.id === id) : undefined;
    if (id && !area) notFound();
    if (area) return <><section className="area-fullscreen" style={{backgroundImage:`url('${area.heroImage}')`}}><div className="area-bottom"><div className="area-text"><h1>{area.title}</h1><p>{area.description}</p></div><Link className="area-contact-btn" href={`/${language}/contactenos`}>{t['nav.contact']}</Link></div></section><section className="related-areas"><div className="container"><h2>{language==='en'?'OTHER RELATED AREAS':'OTRAS ÁREAS RELACIONADAS'}</h2><div className="related-grid">{list.filter((x:any)=>x.id!==area.id).slice(0,3).map((x:any)=><Link className="related-card" href={`/${language}/areas/${x.id}`} key={x.id}><h3>{x.title}</h3><p>{x.description}</p></Link>)}</div></div></section></>;
    return <><Header title={areas[language].title} subtitle={t['header.subtitle.areas']} image="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=1600&q=80"/><section className="container content-below-diagonal"><SearchAreas items={list} lang={language} placeholder={areas[language].searchPlaceholder}/></section></>;
  }
  if (section === 'directorio') {
    const member = id ? directory.members.find((item) => item.id === id) : undefined;
    if (id && !member) notFound();
    if (member) { const role=member.role[language]; return <div className="profile-wrapper"><Link href={`/${language}/directorio`}>← {language==='en'?'Back to directory':'Volver al directorio'}</Link><div className="profile-card"><div className="image-col"><Image src={member.image} alt={member.name} width={500} height={600}/></div><div className="info-col"><h1>{member.name}</h1><h2 className="role">{role}</h2><p><strong>Email:</strong> <a href={`mailto:${member.email}`}>{member.email}</a></p></div></div><div className="experience-container"><h3>{language==='en'?'Experience':'Experiencia'}</h3><p style={{whiteSpace:'pre-line'}}>{member.experience[language]}</p></div></div>; }
    return <><Header title={t['nav.directory']} subtitle={t['header.subtitle.directory']} image="https://images.unsplash.com/photo-1556761175-5973dc0f32b7?w=1600&q=80"/><DirectoryFilters data={directory} lang={language}/></>;
  }
  if (section === 'novedades') { const data=news[language]; return <><Header title={data.title} subtitle={t['header.subtitle.news']} image="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=80"/><NewsTabs data={data} lang={language}/></>; }
  if (section === 'contactenos') { const data=contact[language]; return <><Header title={data.title} subtitle={data.subtitle}/><section className="contact-section container"><h2>{data.info.address}</h2><p>{data.info.phone} · {data.info.email}</p><ContactForm language={language} labels={data.form}/></section></>; }
  if (section === 'nosotros') { const d=about.historia[language]; return <><Header title={t['nav.about']} subtitle={t['header.subtitle.about']} image="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&q=80"/><section className="container about-section"><h2>Faynshteyn Abogados & Consultores</h2><p>{d}</p><div className="mv-grid"><article><h3>{about.mision[language].title}</h3><p>{about.mision[language].text}</p></article><article><h3>{about.vision[language].title}</h3><p>{about.vision[language].text}</p></article></div></section></>; }
  if (section === 'sedes') return <OfficeList language={language} />;
  if (section === 'productos-legales') return <LegalProducts language={language} />;
  notFound();
}

function OfficeList({ language }: { language: Language }) {
  const data = sedes[language];

  return (
    <>
      <Header title={data.title} subtitle={data.subtitle} />
      <div className="container">
        <div className="sedes-grid">
          {data.items.map(({ city, address, phone, email, mapUrl }) => {
            const directions = new URL(mapUrl);
            directions.pathname = '/maps/search/';
            directions.searchParams.set('api', '1');
            directions.searchParams.set('query', address);
            return (
              <article className="sede-card" key={city}>
                <h2>{city}</h2>
                <address>
                  <p className="detail">{address}</p>
                  <p className="detail"><a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a></p>
                  <p className="detail"><a href={`mailto:${email}`}>{email}</a></p>
                </address>
                <a className="map-link" href={directions.href}>
                  {language === 'en' ? 'View on map' : 'Ver en el mapa'}
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}

function LegalProducts({ language }: { language: Language }) {
  const data = products[language];

  return (
    <>
      <Header title={data.title} subtitle={data.subtitle} />
      <div className="container">
        <div className="productos-grid">
          {data.items.map(({ title, description, price }) => (
            <article className="producto-card" key={title}>
              <h2>{title}</h2>
              <p>{description}</p>
              <span className="price-tag">{price}</span>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
