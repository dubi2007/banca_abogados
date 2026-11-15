import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Faynshteyn Abogados', description: 'Faynshteyn Abogados & Consultores' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
