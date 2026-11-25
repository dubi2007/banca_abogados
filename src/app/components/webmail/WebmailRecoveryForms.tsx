'use client';

import { KeyRound, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Language } from '../../../utils/i18n';

type Props = {
  lang: Language;
  available: boolean;
  signedIn: boolean;
};

const errorMessages: Record<string, [string, string]> = {
  unavailable: ['La recuperación desde la web está pendiente de configuración.', 'Webmail recovery is awaiting configuration.'],
  mailbox: ['Ingrese un correo corporativo @faynshteynjuridico.com.', 'Enter a corporate @faynshteynjuridico.com email address.'],
  address: ['Ingrese una dirección diferente a la del buzón.', 'Enter an address different from your mailbox.'],
  current_password: ['Verifique la contraseña actual o vuelva a iniciar sesión.', 'Check your current password or sign in again.'],
  sign_in: ['Vuelva a iniciar sesión para registrar un correo de recuperación.', 'Sign in again to register a recovery email.'],
  throttled: ['Espere un momento antes de pedir otro código.', 'Wait before requesting another code.'],
  code: ['Revise el código de esta solicitud. Si caducó, solicite otro.', 'Check the code for this request. If it expired, request another.'],
  new_password: ['Use entre 12 y 128 caracteres para su nueva contraseña.', 'Use 12 to 128 characters for your new password.'],
  password_rejected: ['El servidor de correo rechazó la contraseña. Pruebe con una más segura.', 'The mail server rejected the password. Try a stronger one.'],
  password_change_denied: ['El servidor de correo rechazó el cambio. Contacte al administrador del correo.', 'The mail server denied the change. Contact your email administrator.'],
  service: ['No se pudo completar la solicitud. Intente de nuevo más tarde.', 'The request could not be completed. Try again later.'],
};

function errorMessage(error: string, lang: Language) {
  return (errorMessages[error] ?? errorMessages.service)[lang === 'en' ? 1 : 0];
}

function RecoveryForm({
  lang,
  available,
  enrolling = false,
  onDismiss,
}: Pick<Props, 'lang' | 'available'> & { enrolling?: boolean; onDismiss?: () => void }) {
  const english = lang === 'en';
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState('');
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const codeInput = useRef<HTMLInputElement>(null);
  const completeStatus = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (challenge) codeInput.current?.focus();
  }, [challenge]);
  useEffect(() => {
    if (complete) completeStatus.current?.focus();
  }, [complete]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !available) return;
    setError('');
    const fields = new FormData(event.currentTarget);
    const submittedEmail = challenge ? email : String(fields.get('email')).trim();
    const password = String(fields.get('password') ?? '');
    const payload: Record<string, string> = { language: lang };

    if (challenge) {
      payload.action = enrolling ? 'complete_enrollment' : 'complete_reset';
      payload.challenge = challenge;
      payload.code = String(fields.get('code')).trim();
      if (!enrolling) {
        if (password !== fields.get('confirmPassword')) {
          setError(english ? 'The passwords must match.' : 'Las contraseñas deben coincidir.');
          return;
        }
        payload.mailbox = email;
        payload.password = password;
      }
    } else if (enrolling) {
      payload.action = 'request_enrollment';
      payload.address = submittedEmail;
      payload.password = password;
    } else {
      payload.action = 'request_reset';
      payload.mailbox = submittedEmail;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/webmail/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { ok?: true; error?: string; challenge?: string };
      if (!response.ok || !result.ok) {
        setError(errorMessage(result.error ?? 'service', lang));
      } else if (challenge) {
        setComplete(true);
      } else if (result.challenge) {
        setEmail(submittedEmail);
        setChallenge(result.challenge);
      } else {
        setError(errorMessage('service', lang));
      }
    } catch {
      setError(errorMessage('service', lang));
    } finally {
      setBusy(false);
    }
  }

  if (complete) {
    return (
      <div className="mt-4 space-y-3">
        <p ref={completeStatus} tabIndex={-1} role="status" className="text-sm leading-relaxed">
          {enrolling
            ? (english ? 'Your recovery email was verified and saved.' : 'Su correo de recuperación quedó verificado y guardado.')
            : (english ? 'Your password was updated. Sign in with your new password.' : 'Su contraseña se actualizó. Ya puede ingresar con la nueva contraseña.')}
        </p>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="button-primary w-full cursor-pointer">
            {english ? 'Go to inbox' : 'Ir a la bandeja'}
          </button>
        ) : (
          <Link href={`/${lang}/webmail`} className="text-link">
            {english ? 'Go to Webmail' : 'Ir al correo'}
          </Link>
        )}
      </div>
    );
  }

  return (
    <form key={challenge} method="post" onSubmit={handleSubmit} className="mt-4 space-y-3">
      {challenge && (
        <p role="status" className="text-sm leading-relaxed">
          {enrolling
            ? (english ? 'Enter the code sent to your alternate email.' : 'Ingrese el código enviado a su correo alternativo.')
            : (english
              ? 'If a verified recovery email is on file, you will receive a code there. It expires in 10 minutes.'
              : 'Si tiene un correo de recuperación verificado, recibirá allí un código. Vence en 10 minutos.')}
        </p>
      )}
      <fieldset disabled={busy || !available} className="min-w-0 space-y-4 disabled:opacity-60">
        {challenge ? (
          <>
            <label className="block text-sm font-medium">
              {english ? 'Verification code' : 'Código de verificación'}
              <input ref={codeInput} className="form-field" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} required />
            </label>
            {!enrolling && (
              <>
                <label className="block text-sm font-medium">
                  {english ? 'New password' : 'Nueva contraseña'}
                  <input className="form-field" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="new-password-hint" required />
                </label>
                <p id="new-password-hint" className="text-xs text-ink-muted">
                  {english ? 'Use 12 to 128 characters.' : 'Use entre 12 y 128 caracteres.'}
                </p>
                <label className="block text-sm font-medium">
                  {english ? 'Confirm new password' : 'Confirme la nueva contraseña'}
                  <input className="form-field" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
                </label>
              </>
            )}
          </>
        ) : (
          <>
            <label className="block text-sm font-medium">
              {enrolling ? (english ? 'Alternate email' : 'Correo alternativo') : (english ? 'Corporate email' : 'Correo corporativo')}
              <input className="form-field" name="email" type="email" autoComplete={enrolling ? 'email' : 'username'} defaultValue={email} maxLength={254} required />
            </label>
            {enrolling && (
              <label className="block text-sm font-medium">
                {english ? 'Current password' : 'Contraseña actual'}
                <input className="form-field" name="password" type="password" autoComplete="current-password" maxLength={512} required />
              </label>
            )}
          </>
        )}
        <button type="submit" className="button-primary w-full cursor-pointer disabled:cursor-default">
          {busy && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
          {challenge
            ? (enrolling ? (english ? 'Verify and save' : 'Verificar y guardar') : (english ? 'Change password' : 'Cambiar contraseña'))
            : (english ? 'Request code' : 'Solicitar código')}
        </button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-900">{error}</p>}
      {(challenge || onDismiss) && (
        <div className="flex flex-wrap gap-x-4">
          {challenge && (
            <button
              type="button"
              disabled={busy}
              className="text-link cursor-pointer disabled:opacity-60"
              onClick={() => { setChallenge(''); setError(''); }}
            >
              {english ? 'Request another code' : 'Solicitar otro código'}
            </button>
          )}
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="text-link min-h-11 cursor-pointer">
              {english ? 'Not now' : 'Ahora no'}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

export function WebmailRecoveryPrompt({ lang, onDismiss }: { lang: Language; onDismiss: () => void }) {
  const english = lang === 'en';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      titleRef.current?.focus();
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onDismiss}
      aria-labelledby="recovery-prompt-title"
      aria-describedby="recovery-prompt-description"
      className="card-surface m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-5 text-ink shadow-xl backdrop:bg-ink-deep/60 sm:p-6"
    >
      <Mail aria-hidden="true" size={22} className="mb-3 text-gold-dark" />
      <h2 ref={titleRef} id="recovery-prompt-title" tabIndex={-1} className="text-2xl leading-tight">
        {english ? 'Set up a recovery email' : 'Configure un correo de recuperación'}
      </h2>
      <p id="recovery-prompt-description" className="mt-3 text-sm leading-relaxed">
        {english
          ? 'Add an alternate address so you can regain access to this mailbox.'
          : 'Registre una dirección alternativa para recuperar el acceso a este buzón.'}
      </p>
      <RecoveryForm lang={lang} available enrolling onDismiss={() => dialogRef.current?.close()} />
    </dialog>
  );
}

export default function WebmailRecoveryForms({ lang, available, signedIn }: Props) {
  const english = lang === 'en';

  return (
    <>
      {!available && (
        <p role="status" className="mt-4 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
          {errorMessage('unavailable', lang)}
        </p>
      )}
      <div className="mt-6 grid items-start gap-4 sm:grid-cols-2 sm:gap-5">
        <section aria-labelledby="reset-password" className="card-surface p-5 sm:p-6">
          <KeyRound aria-hidden="true" size={22} className="mb-3 text-gold-dark" />
          <h2 id="reset-password" className="text-2xl leading-tight">
            {english ? 'Reset your password' : 'Restablecer contraseña'}
          </h2>
          <p className="mt-3 text-sm leading-relaxed">
            {english ? 'Use the recovery email you previously verified.' : 'Use el correo de recuperación que verificó previamente.'}
          </p>
          <RecoveryForm lang={lang} available={available} />
        </section>
        <section id="correo-alternativo" aria-labelledby="recovery-email" className="card-surface scroll-mt-4 p-5 sm:p-6">
          <Mail aria-hidden="true" size={22} className="mb-3 text-gold-dark" />
          <h2 id="recovery-email" className="text-2xl leading-tight">
            {english ? 'Recovery email' : 'Correo de recuperación'}
          </h2>
          <p className="mt-3 text-sm leading-relaxed">
            {signedIn
              ? (english ? 'Register an alternate address you can access.' : 'Registre una dirección alternativa a la que pueda acceder.')
              : (english ? 'Sign in to register or update your alternate address.' : 'Inicie sesión para registrar o actualizar su correo alternativo.')}
          </p>
          {signedIn ? (
            <RecoveryForm lang={lang} available={available} enrolling />
          ) : (
            <Link href={`/${lang}/webmail`} className="text-link mt-2">
              {english ? 'Sign in to Webmail' : 'Iniciar sesión en el correo'}
            </Link>
          )}
        </section>
      </div>
    </>
  );
}
