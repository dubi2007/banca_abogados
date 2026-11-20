'use client';

import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import type news from '../../data/novedades.json';
import type { Language } from '../../utils/i18n';
import ImageWithFallback from './ImageWithFallback';

const tabs = ['eventos', 'noticias', 'youtube', 'publicaciones'] as const;
type NewsTab = (typeof tabs)[number];

export default function NewsTabs({
  data,
  lang,
}: {
  data: (typeof news)[Language];
  lang: Language;
}) {
  const [tab, setTab] = useState<NewsTab>('eventos');
  const english = lang === 'en';

  return (
    <div className="site-container py-10 sm:py-14">
      <div className="mb-7 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label={english ? 'News categories' : 'Categorías de novedades'}>
        {tabs.map((name) => (
          <button
            key={name}
            type="button"
            className="min-h-11 cursor-pointer border-b border-line px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-parchment aria-pressed:border-gold-dark aria-pressed:text-ink sm:px-5"
            aria-pressed={tab === name}
            aria-controls="news-items"
            onClick={() => setTab(name)}
          >
            {data.tabs[name]}
          </button>
        ))}
      </div>
      <div id="news-items">
        {tab === 'eventos' && (
          <div className="grid gap-5 md:grid-cols-2">
            {data.eventos.map(({ title, image, date, description }) => (
              <article className="card-surface" key={title}>
                <div className="relative aspect-[16/8] overflow-hidden bg-parchment">
                  <ImageWithFallback
                    src={image}
                    fallbackSrc="/images/headers/novedades.webp"
                    alt=""
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-5 sm:p-7">
                  <p className="mb-2 text-sm font-semibold text-gold-dark">{date}</p>
                  <h2 className="text-2xl leading-snug">{title}</h2>
                  <p className="mt-3 leading-relaxed">{description}</p>
                </div>
              </article>
            ))}
          </div>
        )}
        {tab === 'noticias' && (
          <div className="grid gap-5 md:grid-cols-2">
            {data.noticias.map(({ title, date, description }) => (
              <article className="card-surface p-5 sm:p-7" key={title}>
                <p className="mb-2 text-sm font-semibold text-gold-dark">{date}</p>
                <h2 className="text-2xl leading-snug">{title}</h2>
                <p className="mt-3 leading-relaxed">{description}</p>
              </article>
            ))}
          </div>
        )}
        {tab === 'youtube' && (
          <div className="grid gap-5 md:grid-cols-2">
            {data.youtube.map(({ title, videoId, date }) => (
              <article className="card-surface p-5 sm:p-7" key={title}>
                <p className="mb-2 text-sm font-semibold text-gold-dark">{date}</p>
                <h2 className="text-2xl leading-snug">{title}</h2>
                {/^[\w-]{11}$/.test(videoId) ? (
                  <a className="text-link mt-2" href={`https://www.youtube.com/watch?v=${videoId}`}>
                    {english ? 'Watch on YouTube' : 'Ver en YouTube'}
                    <ArrowUpRight aria-hidden="true" size={18} />
                  </a>
                ) : (
                  <p className="mt-3 text-sm">{english ? 'Video unavailable' : 'Video no disponible'}</p>
                )}
              </article>
            ))}
          </div>
        )}
        {tab === 'publicaciones' && (
          <div className="grid gap-5 md:grid-cols-2">
            {data.publicaciones.map(({ title, description }) => (
              <article className="card-surface p-5 sm:p-7" key={title}>
                <h2 className="text-2xl leading-snug">{title}</h2>
                <p className="mt-3 leading-relaxed">{description}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
