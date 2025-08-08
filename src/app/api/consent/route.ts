import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession, ensureSessionCookieOnResponse } from '@/lib/session';
import { getCreds, setCreds } from '@/lib/credentialStore';
import { isSupportedForTagPrefetch } from '@/lib/constants';

export const runtime = 'nodejs';

// Returns the consent value for a given site (or all consents if site omitted)
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const site = url.searchParams.get('site') as string | null;

    const res = NextResponse.next();
    const sid = getOrCreateSession(request, res);
    ensureSessionCookieOnResponse(res, sid);

    const entry = await getCreds(sid);
    const consents = entry?.tagPrefetchConsents || {};

    if (site) {
      if (!isSupportedForTagPrefetch(site as any)) {
        return NextResponse.json({ error: 'Unsupported site' }, { status: 400 });
      }
      const value = consents[site] ?? null;
      return NextResponse.json({ site, consent: value });
    }
    return NextResponse.json({ consents });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get consent' }, { status: 500 });
  }
}

// Sets consent for a site: { site: string, value: 'accepted' | 'declined' }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const site = String(body.site || '');
    const value = String(body.value || '');

    if (!isSupportedForTagPrefetch(site as any)) {
      return NextResponse.json({ error: 'Unsupported site' }, { status: 400 });
    }
    if (value !== 'accepted' && value !== 'declined') {
      return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });
    const sid = getOrCreateSession(request, res);
    ensureSessionCookieOnResponse(res, sid);

    const entry = (await getCreds(sid)) || {};
    const consents = { ...(entry.tagPrefetchConsents || {}) };
    consents[site] = value as 'accepted' | 'declined';

    await setCreds(sid, { ...entry, tagPrefetchConsents: consents });

    return res;
  } catch (e) {
    return NextResponse.json({ error: 'Failed to set consent' }, { status: 500 });
  }
}

// Clears consent for a site to go back to "ask later"
export async function DELETE(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const site = url.searchParams.get('site');
    if (!site || !isSupportedForTagPrefetch(site as any)) {
      return NextResponse.json({ error: 'Unsupported or missing site' }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });
    const sid = getOrCreateSession(request, res);
    ensureSessionCookieOnResponse(res, sid);

    const entry = (await getCreds(sid)) || {};
    const consents = { ...(entry.tagPrefetchConsents || {}) };
    delete consents[site];

    await setCreds(sid, { ...entry, tagPrefetchConsents: consents });

    return res;
  } catch (e) {
    return NextResponse.json({ error: 'Failed to clear consent' }, { status: 500 });
  }
}
