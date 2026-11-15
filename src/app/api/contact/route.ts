import { NextResponse } from 'next/server';

const formEndpoint =
  process.env.CONTACT_FORM_ENDPOINT ?? 'https://formspree.io/f/mgorbywq';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { name, email, phone, service, message } = body as Record<
    string,
    unknown
  >;

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof email !== 'string' ||
    !email.trim() ||
    typeof service !== 'string' ||
    !service.trim() ||
    typeof message !== 'string' ||
    !message.trim()
  ) {
    return NextResponse.json(
      { error: 'Name, email, service and message are required.' },
      { status: 400 },
    );
  }

  const response = await fetch(formEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, email, phone, service, message }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'The contact service is unavailable.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
