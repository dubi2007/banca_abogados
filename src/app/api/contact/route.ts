import { NextResponse } from 'next/server';
import { contactLimits, contactServices } from '../../../utils/contact';

const formEndpoint =
  process.env.CONTACT_FORM_ENDPOINT ?? 'https://formspree.io/f/mgorbywq';

function requiredText(value: unknown, maxLength: number) {
  if (typeof value !== 'string' || value.length > maxLength) return undefined;
  return value.trim() || undefined;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const fields = body as Record<string, unknown>;
  const name = requiredText(fields.name, contactLimits.name);
  const email = requiredText(fields.email, contactLimits.email);
  const message = requiredText(fields.message, contactLimits.message);
  const service = contactServices.find((option) => option === fields.service);
  const phone = fields.phone;

  if (
    !name ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !service ||
    !message ||
    (phone !== undefined && (typeof phone !== 'string' || phone.length > contactLimits.phone))
  ) {
    return NextResponse.json({ error: 'Invalid contact fields.' }, { status: 400 });
  }

  try {
    const response = await fetch(formEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, phone: phone?.trim(), service, message }),
      signal: AbortSignal.timeout(8_000),
    });

    if (response.ok) return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'The contact service timed out.' },
        { status: 504 },
      );
    }
  }

  return NextResponse.json(
    { error: 'The contact service is unavailable.' },
    { status: 502 },
  );
}
