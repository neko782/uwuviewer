import { NextRequest, NextResponse } from 'next/server';
import { tagCacheManager } from '@/lib/tagCache';

export async function POST(request: NextRequest) {
  try {
    const { tags, site, apiKey } = await request.json();

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Invalid tags parameter' },
        { status: 400 }
      );
    }

    // Support yande.re, konachan.com, gelbooru.com, rule34.xxx, and e621.net
    if (site !== 'yande.re' && site !== 'konachan.com' && site !== 'gelbooru.com' && site !== 'rule34.xxx' && site !== 'e621.net') {
      return NextResponse.json(
        { error: 'Only yande.re, konachan.com, gelbooru.com, and rule34.xxx are currently supported' },
        { status: 400 }
      );
    }

    const tagInfo = await tagCacheManager.getTagsInfo(site, tags, apiKey);
    
    return NextResponse.json(tagInfo);
  } catch (error) {
    console.error('Error fetching tag info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tag information' },
      { status: 500 }
    );
  }
}