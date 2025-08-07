import { NextRequest, NextResponse } from 'next/server';
import { tagCacheManager } from '@/lib/tagCache';

export async function POST(request: NextRequest) {
  try {
    const { tags, site } = await request.json();

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Invalid tags parameter' },
        { status: 400 }
      );
    }

    // Currently only supporting yande.re
    if (site !== 'yande.re') {
      return NextResponse.json(
        { error: 'Only yande.re is currently supported' },
        { status: 400 }
      );
    }

    const tagInfo = await tagCacheManager.getTagsInfo(tags);
    
    return NextResponse.json(tagInfo);
  } catch (error) {
    console.error('Error fetching tag info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tag information' },
      { status: 500 }
    );
  }
}