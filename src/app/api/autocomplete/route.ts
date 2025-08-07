import { NextRequest, NextResponse } from 'next/server';
import { 
  tagCacheManager,
  YANDERE_TAG_COLORS,
  KONACHAN_TAG_COLORS 
} from '@/lib/tagCache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const site = searchParams.get('site') || 'yande.re';

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Only support yande.re and konachan.com (gelbooru doesn't have cached tags)
    if (site !== 'yande.re' && site !== 'konachan.com') {
      return NextResponse.json({ suggestions: [] });
    }

    // Search the cached tags
    const tags = await tagCacheManager.searchCachedTags(site, query, 10);
    
    // Get the appropriate color map for the site
    const colorMap = site === 'konachan.com' ? KONACHAN_TAG_COLORS : YANDERE_TAG_COLORS;
    
    // Format the response with colors and counts
    const suggestions = tags.map(tag => ({
      name: tag.name,
      count: tag.count,
      type: tag.type,
      color: colorMap[tag.type] || '#888888',
    }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error fetching tag suggestions:', error);
    return NextResponse.json({ suggestions: [] });
  }
}