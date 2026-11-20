import es from '../data/es.json';
import en from '../data/en.json';

const translations = {
  es,
  en,
};

export type Language = 'es' | 'en';

export function useTranslations(lang: string) {
  const l = (lang === 'en' ? 'en' : 'es') as Language;
  
  return function t(key: keyof typeof es) {
    return translations[l][key] || key;
  };
}
