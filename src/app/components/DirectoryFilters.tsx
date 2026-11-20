'use client';

import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type directory from '../../data/directorio.json';
import type { Language } from '../../utils/i18n';

export default function DirectoryFilters({ data, lang }: { data: typeof directory; lang: Language }) {
  const [filters, setFilters] = useState({ category: 'todos', area: 'todos', location: 'todos', name: '' });
  const english = lang === 'en';
  const selects = [
    { key: 'category', label: english ? 'Category' : 'Categoría', options: data.filters.categories },
    { key: 'area', label: english ? 'Practice area' : 'Área de práctica', options: data.filters.areas },
    { key: 'location', label: english ? 'Location' : 'Sede', options: data.filters.locations },
  ] as const;
  const members = data.members.filter((member) =>
    selects.every(({ key }) => filters[key] === 'todos' || member[key] === filters[key])
      && member.name.toLowerCase().includes(filters.name.trim().toLowerCase()),
  );

  return (
    <div className="site-container py-10 sm:py-14">
      <div role="search" aria-label={english ? 'Directory filters' : 'Filtros del directorio'} className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {selects.map(({ key, label, options }) => (
          <label key={key} className="grid min-w-0 gap-2 text-sm font-semibold text-ink">
            {label}
            <select
              className="form-field font-normal"
              value={filters[key]}
              onChange={(event) => setFilters((previous) => ({ ...previous, [key]: event.target.value }))}
            >
              {options.map((option) => <option value={option.id} key={option.id}>{option[lang]}</option>)}
            </select>
          </label>
        ))}
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink">
          {english ? 'Name' : 'Nombre'}
          <input
            type="search"
            className="form-field font-normal"
            value={filters.name}
            onChange={(event) => setFilters((previous) => ({ ...previous, name: event.target.value }))}
          />
        </label>
      </div>

      {members.length === 0 ? (
        <p role="status" className="card-surface p-6">
          {english ? 'No profiles match these filters.' : 'No encontramos perfiles que coincidan con estos filtros.'}
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <li key={member.id} className="min-w-0">
              <Link
                href={`/${lang}/directorio/${member.id}`}
                className="block h-full border-b border-line transition-colors hover:border-gold-dark"
              >
                <div className="relative aspect-[4/4.35] overflow-hidden bg-parchment">
                  <Image src={member.image} alt="" fill sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw" className="object-cover object-top" />
                </div>
                <div className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl leading-snug sm:text-2xl">{member.name}</h2>
                    <ArrowUpRight aria-hidden="true" size={19} className="shrink-0 text-gold-dark" />
                  </div>
                  <p className="mt-2 text-sm">{member.role[lang]}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
