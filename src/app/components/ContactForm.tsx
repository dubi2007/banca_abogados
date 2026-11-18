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
    <form className="elegant-form" onSubmit={submit}>
      <div className="input-group">
        <input id="name" name="name" required maxLength={contactLimits.name} placeholder=" " />
        <label htmlFor="name">{labels.name}</label>
      </div>
      <div className="input-group">
        <input id="email" name="email" type="email" required maxLength={contactLimits.email} placeholder=" " />
        <label htmlFor="email">{labels.email}</label>
      </div>
      <div className="input-group">
        <input id="phone" name="phone" type="tel" maxLength={contactLimits.phone} placeholder=" " />
        <label htmlFor="phone">{labels.phone}</label>
      </div>
      <div className="input-group">
        <select id="service" name="service" required defaultValue="">
          <option value="" disabled />
          {contactServices.map((service) => (
            <option key={service} value={service}>{labels.serviceOptions[service]}</option>
          ))}
        </select>
        <label htmlFor="service">{labels.service}</label>
      </div>
      <div className="input-group">
        <textarea id="message" name="message" rows={4} required maxLength={contactLimits.message} placeholder=" " />
        <label htmlFor="message">{labels.message}</label>
      </div>
      <button type="submit" className="btn-gold" disabled={sending}>
        {sending ? '...' : labels.submit}
      </button>
      <div className="form-status info" role="status" aria-live="polite">
        {status}
      </div>
    </form>
  );
}
