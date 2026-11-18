'use client';

import { useState } from 'react';
import type news from '../../data/novedades.json';
import type { Language } from '../../utils/i18n';

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
    <div className="news-content container content-below-diagonal">
      <div className="news-tabs" role="group" aria-label={english ? 'News categories' : 'Categorías de novedades'}>
        {tabs.map((name) => (
          <button
            key={name}
            type="button"
            className={tab === name ? 'active' : undefined}
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
          <div className="events-grid">
            {data.eventos.map(({ title, image, date, description }) => (
              <article className="event-card" key={title}>
                <img src={image} alt="" loading="lazy" />
                <div className="event-info">
                  <span className="event-date">{date}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        )}
        {tab === 'noticias' && (
          <div className="news-list">
            {data.noticias.map(({ title, date, description }) => (
              <article className="news-item" key={title}>
                <span className="news-date">{date}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        )}
        {tab === 'youtube' && (
          <div className="youtube-grid">
            {data.youtube.map(({ title, videoId, date }) => (
              <article className="youtube-card" key={title}>
                <div className="yt-info">
                  <span className="yt-date">{date}</span>
                  <h3>{title}</h3>
                  {/^[\w-]{11}$/.test(videoId) ? (
                    <a className="yt-link" href={`https://www.youtube.com/watch?v=${videoId}`}>
                      {english ? 'Watch on YouTube' : 'Ver en YouTube'}
                    </a>
                  ) : (
                    <p>{english ? 'Video unavailable' : 'Video no disponible'}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {tab === 'publicaciones' && (
          <div className="pub-list">
            {data.publicaciones.map(({ title, description }) => (
              <article className="pub-item" key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
