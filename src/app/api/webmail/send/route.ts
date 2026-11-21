import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  decryptWebmailSession,
  saveImapDraft,
  sendSmtpEmail,
  WEBMAIL_COOKIE,
  type OutgoingAttachment,
} from '../../../../utils/webmail';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const creds = decryptWebmailSession(cookieStore.get(WEBMAIL_COOKIE)?.value);
  if (!creds) {
    return NextResponse.json({ error: 'Sesión expirada.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const to = typeof body?.to === 'string' ? body.to.trim() : '';
  const cc = typeof body?.cc === 'string' ? body.cc.trim() : undefined;
  const bcc = typeof body?.bcc === 'string' ? body.bcc.trim() : undefined;
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '(Sin asunto)';
  const textBody = typeof body?.body === 'string' ? body.body : '';
  const htmlBody = typeof body?.htmlBody === 'string' ? body.htmlBody : undefined;
  const inReplyTo = typeof body?.inReplyTo === 'string' ? body.inReplyTo.trim() : undefined;
  const isDraft = Boolean(body?.isDraft);

  const rawAttachments = Array.isArray(body?.attachments) ? body.attachments : [];
  const attachments: OutgoingAttachment[] = rawAttachments
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).filename === 'string' &&
        typeof (item as Record<string, unknown>).contentBase64 === 'string',
    )
    .map((item) => ({
      filename: String(item.filename),
      contentType:
        typeof item.contentType === 'string' && item.contentType
          ? item.contentType
          : 'application/octet-stream',
      contentBase64: String(item.contentBase64),
    }));

  if (isDraft) {
    try {
      await saveImapDraft(creds, {
        to,
        cc,
        bcc,
        subject,
        body: textBody,
        htmlBody,
        inReplyTo,
        attachments,
      });
      return NextResponse.json({ ok: true, draft: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el borrador.';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (!to || (!textBody.trim() && !htmlBody?.trim())) {
    return NextResponse.json(
      { error: 'Complete el destinatario y el contenido del mensaje.' },
      { status: 400 },
    );
  }

  try {
    await sendSmtpEmail(creds, {
      to,
      cc,
      bcc,
      subject,
      body: textBody,
      htmlBody,
      inReplyTo,
      attachments,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo enviar el correo por SMTP.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
