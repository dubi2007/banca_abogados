import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  decryptWebmailSession,
  deleteImapMessage,
  fetchImapMailboxState,
  fetchImapMessageDetail,
  moveImapMessage,
  updateImapMessageFlagged,
  updateImapMessageSeen,
  WEBMAIL_COOKIE,
} from '../../../../utils/webmail';

async function getSessionCreds() {
  const cookieStore = await cookies();
  return decryptWebmailSession(cookieStore.get(WEBMAIL_COOKIE)?.value);
}

export async function GET(request: Request) {
  const creds = await getSessionCreds();
  if (!creds) {
    return NextResponse.json({ error: 'Sesión expirada.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder') || 'INBOX';
  const uidParam = searchParams.get('uid');

  try {
    if (uidParam) {
      const uid = parseInt(uidParam, 10);
      if (!Number.isFinite(uid) || uid <= 0) {
        return NextResponse.json({ error: 'UID inválido.' }, { status: 400 });
      }
      const { message, thread } = await fetchImapMessageDetail(creds, folder, uid);
      return NextResponse.json({ message, thread });
    }

    const state = await fetchImapMailboxState(creds, folder, 50);
    return NextResponse.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error consultando servidor IMAP';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const creds = await getSessionCreds();
  if (!creds) {
    return NextResponse.json({ error: 'Sesión expirada.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const folder = typeof body?.folder === 'string' ? body.folder : 'INBOX';
  const uid = Number(body?.uid);

  if (!Number.isFinite(uid) || uid <= 0) {
    return NextResponse.json({ error: 'UID inválido.' }, { status: 400 });
  }

  try {
    if (typeof body?.targetFolder === 'string' && body.targetFolder.trim()) {
      await moveImapMessage(creds, folder, body.targetFolder.trim(), uid);
      return NextResponse.json({ ok: true });
    }
    if (typeof body?.flagged === 'boolean') {
      await updateImapMessageFlagged(creds, folder, uid, body.flagged);
      return NextResponse.json({ ok: true });
    }
    const seen = Boolean(body?.seen);
    await updateImapMessageSeen(creds, folder, uid, seen);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando estado del mensaje';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const creds = await getSessionCreds();
  if (!creds) {
    return NextResponse.json({ error: 'Sesión expirada.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const folder = typeof body?.folder === 'string' ? body.folder : 'INBOX';
  const uid = Number(body?.uid);

  if (!Number.isFinite(uid) || uid <= 0) {
    return NextResponse.json({ error: 'UID inválido.' }, { status: 400 });
  }

  try {
    await deleteImapMessage(creds, folder, uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error eliminando el mensaje';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
