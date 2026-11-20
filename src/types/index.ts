export interface HeroSlideLocal {
  title: string;
  subtitle: string;
  ctaText: string;
}

export interface HeroSlide {
  id: string;
  image: string;
  es: HeroSlideLocal;
  en: HeroSlideLocal;
  ctaHref: string;
}

export interface StatItem {
  label: string;
  value: string;
}

export interface CommitmentItem {
  title: string;
  desc: string;
}

export interface CommitmentLocal {
  title: string;
  items: CommitmentItem[];
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqLocal {
  title: string;
  items: FaqItem[];
}

export interface NewsItem {
  date: string;
  title: string;
}

export interface NewsLocal {
  title: string;
  items: NewsItem[];
}

export interface HomeData {
  hero: {
    slides: HeroSlide[];
  };
  stats: {
    es: StatItem[];
    en: StatItem[];
  };
  commitment: {
    es: CommitmentLocal;
    en: CommitmentLocal;
  };
  faqs: {
    es: FaqLocal;
    en: FaqLocal;
  };
  novedades_empresas: {
    es: NewsLocal;
    en: NewsLocal;
  };
}

export interface TranslationDictionary {
  'nav.about': string;
  'nav.areas': string;
  'nav.locations': string;
  'nav.directory': string;
  'nav.products': string;
  'nav.news': string;
  'nav.contact': string;
  'footer.description': string;
  'footer.copyright': string;
  'footer.nav': string;
  'footer.services': string;
}

export interface AreaItem {
  id: string;
  title: string;
  icon: string;
  description: string;
  heroImage: string;
}

export interface AreaLocal {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  items: AreaItem[];
}

export interface AreasData {
  es: AreaLocal;
  en: AreaLocal;
}
