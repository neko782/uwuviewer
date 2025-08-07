import { NextRequest, NextResponse } from 'next/server';
import { 
  tagCacheManager,
  YANDERE_TAG_COLORS,
  KONACHAN_TAG_COLORS,
  GELBOORU_TAG_COLORS,
  RULE34_TAG_COLORS,
  RULE34_TYPE_TO_NUM,
  E621_TAG_COLORS,
} from '@/lib/tagCache';

interface GelbooruTag {
  id: number;
  name: string;
  count: number;
  type: number;
  ambiguous: boolean;
}

interface CacheEntry {
  data: GelbooruTag[];
  timestamp: number;
}

// In-memory cache for Gelbooru autocomplete results
const gelbooruAutocompleteCache = new Map<string, CacheEntry>();
// In-memory cache for Rule34 autocomplete results (same shape as GelbooruTag sans 'type' mapping)
const rule34AutocompleteCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of gelbooruAutocompleteCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      gelbooruAutocompleteCache.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

async function fetchGelbooruSuggestions(query: string, apiKey?: string): Promise<GelbooruTag[]> {
  // Create cache key based on query and API key presence
  const cacheKey = `${query.toLowerCase()}_${apiKey ? 'auth' : 'noauth'}`;
  
  // Check cache first
  const cached = gelbooruAutocompleteCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Cache hit for Gelbooru autocomplete: ${query}`);
    return cached.data;
  }
  
  try {
    console.log(`Cache miss for Gelbooru autocomplete: ${query}, fetching from API...`);
    
    // Make two parallel requests:
    // 1. Search for tags starting with the query using name_pattern
    // 2. Check if exact tag exists using name
    const apiKeyParam = apiKey || '';
    
    const [patternResponse, exactResponse] = await Promise.all([
      // Request with name_pattern for wildcard search
      fetch(
        `https://gelbooru.com/index.php?page=dapi&s=tag&q=index&name_pattern=${encodeURIComponent(query)}%&limit=10&orderby=count&json=1${apiKeyParam}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      ),
      // Request with exact name to check if the tag itself exists
      fetch(
        `https://gelbooru.com/index.php?page=dapi&s=tag&q=index&name=${encodeURIComponent(query)}&json=1${apiKeyParam}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      )
    ]);

    if (!patternResponse.ok || !exactResponse.ok) {
      console.error('Gelbooru API error:', patternResponse.status, exactResponse.status);
      return [];
    }

    // Parse both responses in parallel
    const [patternData, exactData] = await Promise.all([
      patternResponse.json(),
      exactResponse.json()
    ]);
    
    const patternTags: GelbooruTag[] = patternData.tag || [];
    const exactTag: GelbooruTag | undefined = exactData.tag?.[0];
    
    // Create a map to avoid duplicates
    const tagMap = new Map<string, GelbooruTag>();
    
    // Add exact match first if it exists
    if (exactTag && exactTag.name.toLowerCase() === query.toLowerCase()) {
      tagMap.set(exactTag.name, exactTag);
    }
    
    // Add pattern matches
    for (const tag of patternTags) {
      if (!tagMap.has(tag.name)) {
        tagMap.set(tag.name, tag);
      }
    }
    
    // Convert back to array and sort
    const results = Array.from(tagMap.values());
    
    // Sort by relevance: exact match first, then by count
    const sortedResults = results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === query.toLowerCase();
      const bExact = b.name.toLowerCase() === query.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return b.count - a.count;
    }).slice(0, 10);
    
    // Cache the results
    gelbooruAutocompleteCache.set(cacheKey, {
      data: sortedResults,
      timestamp: Date.now()
    });
    
    console.log(`Cached ${sortedResults.length} results for query: ${query}`);
    
    return sortedResults;
  } catch (error) {
    console.error('Error fetching Gelbooru suggestions:', error);
    return [];
  }
}

interface Rule34Item { label: string; value: string; type: string } // unused: kept for reference

/*
async function fetchRule34Suggestions(query: string): Promise<Array<{ name: string; count: number; typeNum: number }>> {
  const cacheKey = query.toLowerCase();
  const cached = rule34AutocompleteCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    // Transform cached GelbooruTag shape into our return shape
    return cached.data.map((t) => ({ name: t.name, count: t.count, typeNum: t.type }));
  }

  try {
    const url = `https://ac.rule34.xxx/autocomplete.php?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://rule34.xxx',
        'Referer': 'https://rule34.xxx/',
      },
    });
    if (!res.ok) return [];
    const data: Rule34Item[] = await res.json();

    // Deduplicate by value, prefer exact match first
    const map = new Map<string, Rule34Item>();
    for (const item of data) {
      if (!map.has(item.value)) map.set(item.value, item);
    }

    const items = Array.from(map.values());

    const sorted = items.sort((a, b) => {
      const aExact = a.value.toLowerCase() === query.toLowerCase();
      const bExact = b.value.toLowerCase() === query.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      // sort by parsed count desc
      const ac = parseInt((a.label.match(/\(([\d,]+)\)$/)?.[1] || '0').replace(/,/g, ''), 10);
      const bc = parseInt((b.label.match(/\(([\d,]+)\)$/)?.[1] || '0').replace(/,/g, ''), 10);
      return bc - ac;
    }).slice(0, 10);

    const results = sorted.map((item) => {
      const count = parseInt((item.label.match(/\(([\d,]+)\)$/)?.[1] || '0').replace(/,/g, ''), 10);
      const typeNum = RULE34_TYPE_TO_NUM[item.type] ?? 0;
      return { name: item.value, count, typeNum };
    });

    // Cache using GelbooruTag-compatible shape for reuse
    const cacheData: GelbooruTag[] = results.map((r, idx) => ({
      id: idx,
      name: r.name,
      count: r.count,
      type: r.typeNum,
      ambiguous: false,
    }));
    rule34AutocompleteCache.set(cacheKey, { data: cacheData, timestamp: Date.now() });

    return results;
  } catch (e) {
    console.error('Rule34 autocomplete error:', e);
    return [];
  }
}
*/
 
 export async function GET(request: NextRequest) {  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const site = searchParams.get('site') || 'yande.re';
    const apiKey = searchParams.get('apiKey') || '';

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Handle Gelbooru separately
    if (site === 'gelbooru.com') {
      const tags = await fetchGelbooruSuggestions(query, apiKey);
      
      // Format the response with colors and counts
      const suggestions = tags.map(tag => ({
        name: tag.name,
        count: tag.count,
        type: tag.type,
        color: GELBOORU_TAG_COLORS[tag.type] || '#888888',
      }));
      
      return NextResponse.json({ suggestions });
    }

    // Handle Rule34: use local cache ONLY; do not fallback to ac.rule34 to avoid spamming
    if (site === 'rule34.xxx') {
      // Ensure disk cache is loaded into memory (no network)
      await tagCacheManager.ensureCacheLoadedFromDisk('rule34.xxx');
      const tags = tagCacheManager.searchCachedTagsOnly('rule34.xxx', query, 10);
      const suggestions = tags.map(tag => ({
        name: tag.name,
        count: tag.count,
        type: tag.type,
        color: RULE34_TAG_COLORS[tag.type] || '#888888',
      }));
      return NextResponse.json({ suggestions });
    }

    // Handle yande.re, konachan.com, and e621.net with cached tags (cache-only; do not trigger downloads)
    if (site !== 'yande.re' && site !== 'konachan.com' && site !== 'e621.net') {
      return NextResponse.json({ suggestions: [] });
    }

    // Ensure disk cache is loaded into memory (no network)
    await tagCacheManager.ensureCacheLoadedFromDisk(site);

    // Search the cached tags without initiating network fetches
    const tags = tagCacheManager.searchCachedTagsOnly(site, query, 10);
    
    // Get the appropriate color map for the site
    const colorMap = site === 'konachan.com' ? KONACHAN_TAG_COLORS : site === 'e621.net' ? E621_TAG_COLORS : YANDERE_TAG_COLORS;
    
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