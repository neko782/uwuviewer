import { NextRequest, NextResponse } from 'next/server';
import { tagCacheManager } from '@/lib/tagCache';

export async function GET(request: NextRequest) {
  try {
    const site = request.nextUrl.searchParams.get('site');
    if (!site || (site !== 'yande.re' && site !== 'konachan.com' && site !== 'rule34.xxx' && site !== 'e621.net')) {
      return NextResponse.json({ error: 'Invalid or unsupported site' }, { status: 400 });
    }

    const stats = await tagCacheManager.getCacheStats(site);
    return NextResponse.json(stats);
  } catch (e) {
    console.error('status tags failed', e);
    return NextResponse.json({ error: 'Failed to get tag status' }, { status: 500 });
  }
}
