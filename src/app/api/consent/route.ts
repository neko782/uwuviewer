import { NextRequest, NextResponse } from 'next/server';
import { getGlobalCreds, setGlobalCreds } from '@/lib/globalCreds';
import { isSupportedForTagPrefetch } from '@/lib/constants';

export const runtime = 'nodejs';

// Returns the consent value for a given site (or all consents if site omitted)
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const site = url.searchParams.get('site') as string | null;

    const entry = await getGlobalCreds();
    const consents = entry?.tagPrefetchConsents || {};

    if (site) {
      if (!isSupportedForTagPrefetch(site as any)) {
        return NextResponse.json({ error: 'Unsupported site' }, { status: 400 });
      }
      const value = consents[site] ?? null;
      return NextResponse.json({ site, consent: value });
    }
    return NextResponse.json({ consents });
  } catch {
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

    const entry = await getGlobalCreds();
    const consents = { ...(entry.tagPrefetchConsents || {}) };
    consents[site] = value as 'accepted' | 'declined';

    await setGlobalCreds({ tagPrefetchConsents: consents });

    return NextResponse.json({ ok: true });
  } catch {
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

    const entry = await getGlobalCreds();
    const consents = { ...(entry.tagPrefetchConsents || {}) };
    delete consents[site];

    await setGlobalCreds({ tagPrefetchConsents: consents });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to clear consent' }, { status: 500 });
  }
}
