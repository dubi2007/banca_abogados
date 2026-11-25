import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/playfair-display';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Faynshteyn Abogados',
  description: 'Faynshteyn Abogados & Consultores',
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
};

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <html lang={lang === 'en' ? 'en' : 'es'}>
      <body className="flex min-h-dvh flex-col [--site-nav-height:4.5rem] xl:[--site-nav-height:5rem]">
        {children}
      </body>
    </html>
  );
}
