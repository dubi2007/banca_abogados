import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import about from '../../../data/about.json';
import home from '../../../data/home.json';
import type translations from '../../../data/es.json';
import type { Language } from '../../../utils/i18n';
import PracticeAreaLink from '../../components/PracticeAreaLink';

type Props = {
  lang: Language;
  t: typeof translations;
};

export default function HomePage({ lang, t }: Props) {
  const english = lang === 'en';
  const slide = home.hero.slides[0];
  const commitment = home.commitment[lang];
  const facilities = about.instalaciones[lang];

  return (
    <>
      <section id="firma" aria-labelledby="firm-advisory" className="on-dark relative isolate overflow-hidden bg-ink-deep text-white">
        <Image src="/images/estudio/sala-directorio.webp" alt="" fill priority sizes="100vw" className="object-cover object-center" />
        <div aria-hidden="true" className="absolute inset-0 bg-black/70 md:bg-transparent md:bg-linear-to-r md:from-black/90 md:via-black/70 md:to-black/15" />
        <div className="site-container relative flex min-h-[24rem] flex-col justify-center py-12 sm:min-h-[27rem] lg:min-h-[min(62svh,36rem)] lg:py-16">
          <h1 id="firm-advisory" className="max-w-[15ch] font-serif text-[clamp(2.55rem,5.1vw,4.65rem)] leading-[1.08] text-white">
            {english ? 'Business legal advisory' : 'Asesoría legal empresarial'}
          </h1>
          <div className="mt-5 max-w-[33rem]">
            <p className="text-base leading-relaxed text-white/95 sm:text-lg">
              {english
                ? 'We advise companies and international clients on corporate matters, regulation and dispute resolution.'
                : 'Asesoramos a empresas y clientes internacionales en asuntos corporativos, regulatorios y de resolución de controversias.'}
            </p>
            <Link className="mt-6 inline-flex min-h-11 items-center gap-3 border-b border-gold text-sm font-medium text-white hover:text-gold" href={`/${lang}/nosotros`}>
              {english ? 'About the firm' : 'Conozca el estudio'}
              <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="home-practice-areas" className="site-container py-12 sm:py-16">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-1">
          <h2 id="home-practice-areas" className="section-heading">{t['home.areas.title']}</h2>
          <Link className="text-link" href={`/${lang}/areas`}>
            {t['home.areas.viewAll']}
            <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} />
          </Link>
        </div>
        <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-10 lg:gap-x-14">
          {home.practice_areas[lang].map(({ link, title, desc, icon }) => (
            <li key={link} className="min-w-0">
              <PracticeAreaLink href={`/${lang}${link}`} title={title} description={desc} icon={icon} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-facilities" className="border-t border-line bg-parchment py-12 sm:py-16">
        <div className="site-container">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <div>
              <h2 id="home-facilities" className="section-heading">{facilities.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed sm:text-base">{facilities.subtitle}</p>
            </div>
            <Link className="text-link" href={`/${lang}/nosotros`}>
              {english ? 'Explore the firm' : 'Conocer más del estudio'}
              <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

      <section aria-labelledby="home-pro-bono" className="border-y border-line bg-paper">
        <div className="site-container grid items-center gap-7 py-10 md:grid-cols-2 lg:gap-14 lg:py-14">
          <div className="relative aspect-[2.15/1] overflow-hidden bg-line md:aspect-[1.9/1]">
            <Image
              src="/images/estudio/despacho-principal.webp"
              alt=""
              fill
              sizes="(min-width: 1280px) 560px, (min-width: 768px) 45vw, 100vw"
              className="object-cover object-center"
            />
          </div>
          <div>
            <h2 id="home-pro-bono" className="section-heading">{slide[lang].title}</h2>
            <p className="mt-3 max-w-xl leading-relaxed">{slide[lang].subtitle}</p>
            <Link className="text-link mt-2" href={`/${lang}/nosotros`}>
              {slide[lang].ctaText}
              <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="home-commitment" className="site-container py-12 sm:py-16">
        <h2 id="home-commitment" className="section-heading">{commitment.title}</h2>
        <div className="mt-7 grid gap-6 md:grid-cols-3 lg:gap-10">
          {commitment.items.map(({ title, desc }) => (
            <article key={title} className="border-t border-gold-dark pt-4">
              <h3 className="text-xl leading-snug">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed">{desc}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
