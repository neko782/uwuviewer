import { NextRequest, NextResponse } from 'next/server';
import { tagCacheManager } from '@/lib/tagCache';

export async function POST(request: NextRequest) {
  try {
    const { site } = await request.json();

    if (!site || (site !== 'yande.re' && site !== 'konachan.com' && site !== 'rule34.xxx')) {
      return NextResponse.json({ error: 'Invalid or unsupported site' }, { status: 400 });
    }

    // Start background refresh without blocking
    tagCacheManager.refreshInBackground(site);

    return NextResponse.json({ started: true });
  } catch (e) {
    console.error('prepare tags failed', e);
    return NextResponse.json({ error: 'Failed to start tag preparation' }, { status: 500 });
  }
}
