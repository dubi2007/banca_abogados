'use client';

import { Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AreaItem } from '../../types';
import type { Language } from '../../utils/i18n';
import PracticeAreaLink from './PracticeAreaLink';

type Props = {
  items: Pick<AreaItem, 'id' | 'title' | 'description' | 'icon'>[];
  lang: Language;
  placeholder: string;
};

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function SearchAreas({ items, lang, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const english = lang === 'en';
  const label = english ? 'Search practice areas' : 'Buscar áreas de práctica';
  const terms = normalize(query.trim()).split(/\s+/);
  const results = items.filter(({ title, description }) => {
    const content = normalize(`${title} ${description}`);
    return terms.every((term) => content.includes(term));
  });
  const resultLabel = english
    ? (results.length === 1 ? 'practice area' : 'practice areas')
    : (results.length === 1 ? 'área de práctica' : 'áreas de práctica');

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(12rem,1fr)_minmax(0,3fr)] lg:gap-10 xl:gap-12">
      <div className="lg:sticky lg:top-28 lg:border-r lg:border-line lg:pr-6">
        <div role="search" aria-label={label}>
          <label htmlFor="practice-search" className="mb-2 block text-sm font-semibold text-ink">{label}</label>
          <div className="relative">
            <Search aria-hidden="true" size={18} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-gold-dark" />
            <input
              ref={field}
              id="practice-search"
              type="search"
              aria-controls="practice-results"
              className={`form-field min-h-12 pl-7 [&::-webkit-search-cancel-button]:appearance-none ${query ? 'pr-11' : 'pr-1'}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
            />
            {query && (
              <button
                type="button"
                aria-label={english ? 'Clear search' : 'Limpiar búsqueda'}
                className="absolute inset-y-0 right-0 grid min-w-11 cursor-pointer place-items-center text-ink-muted hover:text-ink focus-visible:outline-offset-[-4px]"
                onClick={() => {
                  setQuery('');
                  field.current?.focus();
                }}
              >
                <X aria-hidden="true" size={18} />
              </button>
            )}
          </div>
        </div>
        <p role="status" aria-atomic="true" className="mt-3 text-sm">{results.length} {resultLabel}</p>
      </div>
      {results.length === 0 ? (
        <p id="practice-results" className="border-y border-line py-6 text-ink">
          {english ? 'No practice areas match your search.' : 'No encontramos áreas que coincidan con su búsqueda.'}
        </p>
      ) : (
        <ul id="practice-results" className="grid border-t border-line sm:grid-cols-2 sm:gap-x-8 xl:gap-x-10">
          {results.map(({ id, title, description, icon }) => (
            <li key={id} className="min-w-0">
              <PracticeAreaLink
                href={`/${lang}/areas/${id}`}
                title={title}
                description={description}
                icon={icon}
                heading="h2"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
