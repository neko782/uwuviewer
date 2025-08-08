import { NextRequest, NextResponse } from 'next/server';
import { tagCacheManager } from '@/lib/tagCache';
import { getGlobalCreds } from '@/lib/globalCreds';

export async function POST(request: NextRequest) {
  try {
    const { tags, site, apiKey: apiKeyBody } = await request.json();
    let apiKey = apiKeyBody || '';
    if (!apiKey && site === 'gelbooru.com') {
      const creds = await getGlobalCreds();
      apiKey = creds.gelbooruApiFragment || '';
    }

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