import Link from 'next/link';
import Image from 'next/image';
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

type Props = { params: Promise<{ lang: string; slug?: string[] }> };
const langs = ['es', 'en'];
const paths = ['', 'areas', 'nosotros', 'sedes', 'directorio', 'productos-legales', 'novedades', 'contactenos'];
export function generateStaticParams() {
  const result: {lang:string;slug?:string[]}[] = [];
  for (const lang of langs) {
    for (const path of paths) result.push({ lang, slug: path ? [path] : undefined });
    for (const a of areas[lang as 'es'|'en'].items) result.push({lang, slug:['areas', a.id]});
    for (const m of directory.members) result.push({lang, slug:['directorio', m.id]});
  }
  return result;
}

function Header({ title, subtitle, image }: {title:string;subtitle?:string;image?:string}) {
  return <div className="page-header" style={image ? {backgroundImage:`url('${image}')`} : undefined}><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>;
}
function Home({lang,t}:{lang:string;t:Record<string,string>}) {
  const data = home.practice_areas[lang as 'es'|'en'];
  return <><section className="hero"><div className="container"><h1>{home.hero.slides[0][lang as 'es'|'en'].title}</h1><p>{home.hero.slides[0][lang as 'es'|'en'].subtitle}</p></div></section><section className="home-areas content-below-diagonal"><div className="container"><h2>{t['home.areas.title']}</h2><p>{t['home.areas.subtitle']}</p><div className="areas-grid">{data.map((a:any)=><Link className="area-card" href={`/${lang}${a.link}`} key={a.id}><h3>{a.title}</h3></Link>)}</div></div></section><section className="home-commitment"><div className="container"><h2>{home.commitment[lang as 'es'|'en'].title}</h2>{home.commitment[lang as 'es'|'en'].items.map((x:any)=><article key={x.title}><h3>{x.title}</h3></article>)}</div></section></>;
}
export default async function RoutePage({params}: Props) {
  const {lang, slug=[]} = await params; const language = lang === 'en' ? 'en' : 'es'; const t = language === 'en' ? en : es; const section = slug[0] || '';
  if (!langs.includes(lang)) return <Header title="404"/>;
  if (!section) return <Home lang={language} t={t}/>;
  if (section === 'areas') {
    const list = areas[language].items; const area = slug[1] ? list.find((x:any)=>x.id===slug[1]) : null;
    if (slug[1] && !area) return <Header title="404"/>;
    if (area) return <><section className="area-fullscreen" style={{backgroundImage:`url('${area.heroImage}')`}}><div className="area-bottom"><div className="area-text"><h1>{area.title}</h1><p>{area.description}</p></div><Link className="area-contact-btn" href={`/${language}/contactenos`}>{t['nav.contact']}</Link></div></section><section className="related-areas"><div className="container"><h2>{language==='en'?'OTHER RELATED AREAS':'OTRAS ÁREAS RELACIONADAS'}</h2><div className="related-grid">{list.filter((x:any)=>x.id!==area.id).slice(0,3).map((x:any)=><Link className="related-card" href={`/${language}/areas/${x.id}`} key={x.id}><h3>{x.title}</h3><p>{x.description}</p></Link>)}</div></div></section></>;
    return <><Header title={areas[language].title} subtitle={t['header.subtitle.areas']} image="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=1600&q=80"/><section className="container content-below-diagonal"><SearchAreas items={list} lang={language} placeholder={areas[language].searchPlaceholder}/></section></>;
  }
  if (section === 'directorio') {
    const member = slug[1] ? directory.members.find((x:any)=>x.id===slug[1]) : null;
    if (slug[1] && !member) return <Header title="404"/>;
    if (member) { const role=member.role[language]; return <div className="profile-wrapper"><Link href={`/${language}/directorio`}>← {language==='en'?'Back to directory':'Volver al directorio'}</Link><div className="profile-card"><div className="image-col"><Image src={member.image} alt={member.name} width={500} height={600}/></div><div className="info-col"><h1>{member.name}</h1><h2 className="role">{role}</h2><p><strong>Email:</strong> <a href={`mailto:${member.email}`}>{member.email}</a></p></div></div><div className="experience-container"><h3>{language==='en'?'Experience':'Experiencia'}</h3><p style={{whiteSpace:'pre-line'}}>{member.experience[language]}</p></div></div>; }
    return <><Header title={t['nav.directory']} subtitle={t['header.subtitle.directory']} image="https://images.unsplash.com/photo-1556761175-5973dc0f32b7?w=1600&q=80"/><DirectoryFilters data={directory} lang={language}/></>;
  }
  if (section === 'novedades') { const data=news[language]; return <><Header title={data.title} subtitle={t['header.subtitle.news']} image="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=80"/><NewsTabs data={data}/></>; }
  if (section === 'contactenos') { const data=contact[language]; return <><Header title={data.title} subtitle={data.subtitle}/><section className="contact-section container"><h2>{data.info.address}</h2><p>{data.info.phone} · {data.info.email}</p><ContactForm language={language} labels={data.form}/></section></>; }
  if (section === 'nosotros') { const d=about.historia[language]; return <><Header title={t['nav.about']} subtitle={t['header.subtitle.about']} image="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&q=80"/><section className="container about-section"><h2>Faynshteyn Abogados & Consultores</h2><p>{d}</p><div className="mv-grid"><article><h3>{about.mision[language].title}</h3><p>{about.mision[language].text}</p></article><article><h3>{about.vision[language].title}</h3><p>{about.vision[language].text}</p></article></div></section></>; }
  const simple = section === 'sedes' ? sedes[language] : section === 'productos-legales' ? products[language] : null;
  return <><Header title={t[`nav.${section==='sedes'?'locations':'products'}`] || section} subtitle={t[`header.subtitle.${section==='sedes'?'locations':'products'}`]}/><section className="container content-below-diagonal"><pre className="data-content">{JSON.stringify(simple, null, 2)}</pre></section></>;
}
