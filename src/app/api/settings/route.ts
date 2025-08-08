import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession, ensureSessionCookieOnResponse } from '@/lib/session';
import { getCreds, setCreds } from '@/lib/credentialStore';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const res = NextResponse.json({ ok: true });
    const sid = getOrCreateSession(request, res);
    ensureSessionCookieOnResponse(res, sid);

    const entry = await getCreds(sid);
    const blocklist = (entry?.blocklistTags || '').trim();
    return NextResponse.json({ blocklist });
  } catch {
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let blocklist = String(body.blocklist ?? '');
    // normalize whitespace to single spaces
    blocklist = blocklist.replace(/\s+/g, ' ').trim();

    const res = NextResponse.json({ ok: true });
    const sid = getOrCreateSession(request, res);
    ensureSessionCookieOnResponse(res, sid);

    const entry = (await getCreds(sid)) || {};
    await setCreds(sid, { ...entry, blocklistTags: blocklist });

    return res;
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const res = NextResponse.json({ ok: true });
    const sid = getOrCreateSession(request, res);
    ensureSessionCookieOnResponse(res, sid);

    const entry = (await getCreds(sid)) || {};
    if (entry.blocklistTags) {
      await setCreds(sid, { ...entry, blocklistTags: '' });
    }
    return res;
  } catch {
    return NextResponse.json({ error: 'Failed to clear settings' }, { status: 500 });
  }
}
