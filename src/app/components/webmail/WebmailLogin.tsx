'use client';

import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { Language } from '../../../utils/i18n';

type Props = {
  lang: Language;
  onAuthenticated: (data: { email: string }) => void;
};

export default function WebmailLogin({ lang, onAuthenticated }: Props) {
  const english = lang === 'en';

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/webmail/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          password: passwordInput,
        }),
      });
      if (!res.ok) {
        setLoginError(
          english
            ? 'Could not sign in. Check your email and password.'
            : 'No se pudo iniciar sesión. Verifique su correo y contraseña.',
        );
        return;
      }
      const data = await res.json();
      setPasswordInput('');
      onAuthenticated({ email: data.email });
    } catch {
      setLoginError(
        english
          ? 'Network error connecting to the mail server.'
          : 'Error de red al conectar con el servidor de correo.',
      );
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <section aria-labelledby="webmail-login-title" className="flex min-h-dvh flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-12">
      <div className="card-surface w-full max-w-md border-t-4 border-t-gold p-6 shadow-xs sm:p-8">
        <div className="flex items-center gap-3 border-b border-line pb-5">
          <Image
            src="/images/intro/logo_fondo_transparente.png"
            alt=""
            width={42}
            height={38}
            unoptimized
            className="h-auto w-10"
          />
          <div>
            <h1 id="webmail-login-title" className="text-2xl leading-tight">
              {english ? 'Sign in to Webmail' : 'Iniciar sesión'}
            </h1>
            <p className="text-xs text-ink-muted">
              Faynshteyn Abogados &amp; Consultores
            </p>
          </div>
        </div>

        {loginError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 border border-red-800/30 bg-red-950/5 p-3.5 text-xs leading-relaxed text-red-900"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-800" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <label
              htmlFor="wm-email"
              className="block text-xs font-semibold tracking-wider text-ink uppercase"
            >
              {english ? 'Corporate Email' : 'Correo corporativo'}
            </label>
            <div className="relative mt-1">
              <input
                id="wm-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder={english ? 'name@faynshteynjuridico.com' : 'nombre@faynshteynjuridico.com'}
                className="form-field pr-9"
              />
              <Mail
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute top-3.5 right-2 text-ink-muted"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="wm-password"
              className="block text-xs font-semibold tracking-wider text-ink uppercase"
            >
              {english ? 'Password' : 'Contraseña'}
            </label>
            <div className="relative mt-1">
              <input
                id="wm-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="form-field pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={english
                  ? (showPassword ? 'Hide password' : 'Show password')
                  : (showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña')}
                className="absolute inset-y-0 right-0 grid min-w-11 cursor-pointer place-items-center rounded-lg text-ink-muted hover:text-ink"
              >
                {showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="button-primary w-full cursor-pointer justify-center py-3 disabled:opacity-60"
          >
            {loginLoading ? (
              <>
                <Loader2 aria-hidden="true" size={17} className="animate-spin" />
                <span>
                  {english ? 'Signing in...' : 'Iniciando sesión...'}
                </span>
              </>
            ) : (
              <>
                <Lock aria-hidden="true" size={16} />
                <span>{english ? 'Enter Inbox' : 'Ingresar a la bandeja'}</span>
              </>
            )}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4">
          <Link href={`/${lang}/webmail/recuperacion`} className="text-link">
            {english ? 'Forgot your password?' : '¿Olvidó su contraseña?'}
          </Link>
          <Link href={`/${lang}`} className="text-link">
            <ArrowLeft aria-hidden="true" size={16} />
            {english ? 'Back to the website' : 'Volver al sitio'}
          </Link>
        </div>
      </div>
    </section>
  );
}
