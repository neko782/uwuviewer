import { NextRequest, NextResponse } from 'next/server';
import { tagCacheManager } from '@/lib/tagCache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const site = searchParams.get('site') || 'yande.re';
    const apiKey = searchParams.get('apiKey') || '';

    if (!query) {
      return NextResponse.json({ suggestions: [] });
    }

    // Only support yande.re and konachan.com for now (gelbooru doesn't have cached tags)
    if (site !== 'yande.re' && site !== 'konachan.com') {
      return NextResponse.json({ suggestions: [] });
    }

    // Ensure cache is loaded
    await tagCacheManager.ensureCache(site);
    
    // Get the cache directly (we need to expose a method for this)
    // For now, we'll use the searchTags method from the API
    const { ImageBoardAPI } = await import('@/lib/api');
    const api = new ImageBoardAPI(site as any, apiKey);
    const tags = await api.searchTags(query);
    
    // Format the response with colors and counts
    const suggestions = tags.slice(0, 10).map((tag: any) => {
      const colorMap = site === 'konachan.com' 
        ? {
            0: '#8B5A3C', // General
            1: '#B8860B', // Artist
            3: '#8B4789', // Copyright
            4: '#2E7D32', // Character
            5: '#C62828', // Style
            6: '#1565C0', // Circle
          }
        : {
            0: '#8B5A3C', // General
            1: '#B8860B', // Artist
            3: '#8B4789', // Copyright
            4: '#2E7D32', // Character
            5: '#1565C0', // Circle
            6: '#C62828', // Faults
          };
      
      return {
        name: tag.name,
        count: tag.count,
        type: tag.type,
        color: colorMap[tag.type as keyof typeof colorMap] || '#888888',
      };
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error fetching tag suggestions:', error);
    return NextResponse.json({ suggestions: [] });
  }
}