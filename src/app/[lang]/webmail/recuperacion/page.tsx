import { ArrowLeft } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import WebmailRecoveryForms from '../../../components/webmail/WebmailRecoveryForms';
import { decryptWebmailSession, WEBMAIL_COOKIE } from '../../../../utils/webmail';
import { getWebmailRecoveryConfig, recoveryMailbox } from '../../../../utils/webmailRecovery';

export default async function WebmailRecoveryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== 'es' && lang !== 'en') notFound();
  const cookieStore = await cookies();
  const session = decryptWebmailSession(cookieStore.get(WEBMAIL_COOKIE)?.value);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-8 sm:px-8 sm:py-12">
      <Link href={`/${lang}/webmail`} className="text-link mb-3 w-fit">
        <ArrowLeft aria-hidden="true" size={16} />
        {lang === 'en' ? 'Back to Webmail' : 'Volver al correo'}
      </Link>
      <h1 className="section-heading">{lang === 'en' ? 'Account recovery' : 'Recuperación de cuenta'}</h1>
      <WebmailRecoveryForms
        lang={lang}
        available={Boolean(getWebmailRecoveryConfig())}
        signedIn={Boolean(recoveryMailbox(session?.email))}
      />
    </div>
  );
}
