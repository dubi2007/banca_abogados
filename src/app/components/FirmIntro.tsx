'use client';

import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Language } from '../../utils/i18n';

// A document reload creates a fresh module. App Router transitions reuse it.
let playedInThisDocument = false;

export default function FirmIntro({ lang }: { lang: Language }) {
  const english = lang === 'en';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const started = useRef(false);
  const [finished, setFinished] = useState(false);
  const [closing, setClosing] = useState(false);

  const dismiss = useCallback(() => {
    dialogRef.current?.close();
    setFinished(true);
  }, []);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ((!started.current && playedInThisDocument) || getComputedStyle(dialog).visibility === 'hidden') {
      dismiss();
      return;
    }

    started.current = true;
    playedInThisDocument = true;
    // Promote the initially visible server-rendered splash to a native modal.
    dialog.removeAttribute('open');
    dialog.showModal();
    nameRef.current?.focus({ preventScroll: true });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hold = reduced ? 650 : 1800;
    const fadeTimer = window.setTimeout(() => setClosing(true), hold);
    const endTimer = window.setTimeout(dismiss, hold + (reduced ? 0 : 300));
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(endTimer);
      dialog.close();
    };
  }, [dismiss, finished]);

  if (finished) return null;

  return (
    <dialog
      id="firm-intro"
      ref={dialogRef}
      open
      aria-label={english ? 'Faynshteyn firm introduction' : 'Presentación de Faynshteyn'}
      onCancel={dismiss}
      className={`on-dark fixed inset-0 z-50 m-0 h-dvh max-h-none w-full max-w-none overflow-auto border-0 bg-ink-deep p-0 text-white backdrop:bg-transparent motion-safe:transition-opacity motion-safe:duration-300 ${closing ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="relative grid h-full min-h-56 place-items-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-4 border border-gold/30 sm:inset-7 lg:inset-10" />
        <div className="relative">
          <Image
            src="/images/intro/logo_fondo_transparente.png"
            alt=""
            width={190}
            height={168}
            unoptimized
            priority
            className="h-auto max-h-[30dvh] w-[clamp(8rem,22vw,11.875rem)] object-contain motion-safe:animate-intro-logo"
          />
          <div className="absolute top-full left-1/2 mt-[clamp(0.5rem,2.5dvh,1.5rem)] w-max max-w-[88vw] -translate-x-1/2 text-center">
            <p ref={nameRef} tabIndex={-1} className="font-serif text-[clamp(1.65rem,min(6.25vw,7dvh),3.8rem)] leading-tight tracking-[0.12em] text-white focus-visible:outline-none">
              FAYNSHTEYN
            </p>
            <p className="mt-2.5 text-[0.63rem] font-medium tracking-[0.19em] text-gold uppercase sm:text-xs">
              {english ? 'Lawyers & Consultants' : 'Abogados & Consultores'}
            </p>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="absolute top-5 right-6 inline-flex min-h-11 cursor-pointer items-center gap-2 px-2 text-xs tracking-wider text-white/85 hover:text-gold sm:top-8 sm:right-10 lg:top-11 lg:right-13">
          {english ? 'Skip introduction' : 'Saltar presentación'}
          <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </button>
      </div>
    </dialog>
  );
}
