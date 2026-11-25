import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WebmailClient from '../../components/WebmailClient';

export const metadata: Metadata = {
  title: 'Webmail | Faynshteyn Abogados',
};

export function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }];
}

export default async function WebmailPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== 'es' && lang !== 'en') notFound();

  return <WebmailClient lang={lang} />;
}
