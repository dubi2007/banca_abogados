import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import areas from '../../../data/areas.json';
import type { Language } from '../../../utils/i18n';
import PageHero from '../../components/PageHero';
import PracticeAreaLink from '../../components/PracticeAreaLink';
import SearchAreas from '../../components/SearchAreas';

const areasCover = '/images/headers/areas.webp';

type Props = {
  lang: Language;
  id?: string;
  subtitle: string;
};

export default function PracticeAreas({ lang, id, subtitle }: Props) {
  const data = areas[lang];

  if (!id) {
    const items = data.items.map(({ id, title, description, icon }) => ({ id, title, description, icon }));

    return (
      <>
        <PageHero title={data.title} subtitle={subtitle} image={areasCover} />
        <div className="site-container py-9 sm:py-12 lg:py-14">
          <SearchAreas items={items} lang={lang} placeholder={data.searchPlaceholder} />
        </div>
      </>
    );
  }

  const area = data.items.find((item) => item.id === id);
  if (!area) notFound();

  const english = lang === 'en';
  const related = data.items.filter((item) => item.id !== id).slice(0, 3);

  return (
    <>
      <div className="site-container">
        <Link href={`/${lang}/areas`} className="text-link my-1">
          <ArrowLeft aria-hidden="true" size={18} />
          {english ? 'Back to practice areas' : 'Volver a las áreas de práctica'}
        </Link>
      </div>
      <PageHero
        title={area.title}
        subtitle={area.description}
        image={area.heroImage}
        fallbackImage={area.heroImage === areasCover ? undefined : areasCover}
      >
        <Link className="button-primary" href={`/${lang}/contactenos`}>
          {english ? 'Request a consultation' : 'Solicitar una consulta'}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </PageHero>
      <section aria-labelledby="other-practice-areas" className="site-container py-10 sm:py-14">
        <h2 id="other-practice-areas" className="section-heading">
          {english ? 'Other practice areas' : 'Otras áreas de práctica'}
        </h2>
        <ul className="mt-6 grid border-t border-line sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3 lg:gap-x-10">
          {related.map(({ id, title, description, icon }) => (
            <li key={id} className="min-w-0">
              <PracticeAreaLink title={title} description={description} icon={icon} href={`/${lang}/areas/${id}`} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
