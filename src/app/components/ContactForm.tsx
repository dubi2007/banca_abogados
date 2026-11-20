'use client';

import { type FormEvent, useState } from 'react';
import { contactLimits, contactServices } from '../../utils/contact';

type ContactFormProps = {
  labels: {
    name: string;
    email: string;
    phone: string;
    service: string;
    serviceOptions: Record<(typeof contactServices)[number], string>;
    message: string;
    submit: string;
  };
  language: 'es' | 'en';
};

export default function ContactForm({ labels, language }: ContactFormProps) {
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setStatus(language === 'en' ? 'Sending...' : 'Enviando...');

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Contact request failed');
      }

      form.reset();
      setStatus(
        language === 'en'
          ? 'Message sent successfully!'
          : '¡Mensaje enviado con éxito!',
      );
    } catch {
      setStatus(
        language === 'en'
          ? 'An error occurred. Please try again.'
          : 'Ocurrió un error. Por favor, intenta de nuevo.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card-surface grid gap-5 p-6 sm:grid-cols-2 sm:p-8" onSubmit={submit}>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink" htmlFor="name">
        {labels.name}
        <input className="form-field font-normal" id="name" name="name" autoComplete="name" required maxLength={contactLimits.name} />
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink" htmlFor="email">
        {labels.email}
        <input className="form-field font-normal" id="email" name="email" type="email" autoComplete="email" required maxLength={contactLimits.email} />
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink" htmlFor="phone">
        {labels.phone}
        <input className="form-field font-normal" id="phone" name="phone" type="tel" autoComplete="tel" maxLength={contactLimits.phone} />
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink" htmlFor="service">
        {labels.service}
        <select className="form-field font-normal" id="service" name="service" required defaultValue="">
          <option value="" disabled>{language === 'en' ? 'Select an area' : 'Selecciona un área'}</option>
          {contactServices.map((service) => (
            <option key={service} value={service}>{labels.serviceOptions[service]}</option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-ink sm:col-span-2" htmlFor="message">
        {labels.message}
        <textarea className="form-field min-h-32 resize-y font-normal" id="message" name="message" rows={4} required maxLength={contactLimits.message} />
      </label>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-2">
        <button type="submit" className="button-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" disabled={sending}>
          {labels.submit}
        </button>
        <p className="text-sm" role="status">{status}</p>
      </div>
    </form>
  );
}
