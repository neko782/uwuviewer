import fs from 'fs/promises';
import path from 'path';

interface Tag {
  id: number;
  name: string;
  count: number;
  type: number;
  ambiguous: boolean;
}

interface TagCache {
  tags: Map<string, Tag>;
  lastFetch: number;
}

interface SerializedCache {
  tags: [string, Tag][];
  lastFetch: number;
}

const YANDERE_TAG_COLORS: Record<number, string> = {
  0: '#8B5A3C', // General - brown/sienna
  1: '#B8860B', // Artist - dark goldenrod
  3: '#8B4789', // Copyright - dark orchid
  4: '#2E7D32', // Character - forest green
  5: '#1565C0', // Circle - medium blue
  6: '#C62828', // Faults - dark red
};

const KONACHAN_TAG_COLORS: Record<number, string> = {
  0: '#8B5A3C', // General - brown/sienna (same as yandere)
  1: '#B8860B', // Artist - dark goldenrod (same as yandere)
  3: '#8B4789', // Copyright - dark orchid (same as yandere)
  4: '#2E7D32', // Character - forest green (same as yandere)
  5: '#1565C0', // Style - medium blue (same as yandere circle)
  6: '#C62828', // Circle - dark red (using faults color from yandere)
};

const YANDERE_TAG_TYPE_NAMES: Record<number, string> = {
  0: 'General',
  1: 'Artist',
  3: 'Copyright',
  4: 'Character',
  5: 'Circle',
  6: 'Faults',
};

const KONACHAN_TAG_TYPE_NAMES: Record<number, string> = {
  0: 'General',
  1: 'Artist',
  3: 'Copyright',
  4: 'Character',
  5: 'Style',
  6: 'Circle',
};

class TagCacheManager {
  private caches: Map<string, TagCache | null> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private fetchPromises: Map<string, Promise<void>> = new Map();
  private loadPromises: Map<string, Promise<void>> = new Map();
  private readonly DATA_DIR = path.join(process.cwd(), 'data');

  constructor() {
    this.ensureDataDir();
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.DATA_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  private getCacheFilePath(site: string): string {
    const sanitizedSite = site.replace(/[^a-z0-9]/gi, '_');
    return path.join(this.DATA_DIR, `${sanitizedSite}_tag_cache.json`);
  }

  private async loadCacheFromDisk(site: string): Promise<void> {
    try {
      const cacheFile = this.getCacheFilePath(site);
      const data = await fs.readFile(cacheFile, 'utf-8');
      const serialized: SerializedCache = JSON.parse(data);
      
      const now = Date.now();
      if (now - serialized.lastFetch < this.CACHE_DURATION) {
        this.caches.set(site, {
          tags: new Map(serialized.tags),
          lastFetch: serialized.lastFetch,
        });
        console.log(`Loaded ${serialized.tags.length} tags from disk cache for ${site} (age: ${Math.round((now - serialized.lastFetch) / 1000 / 60)} minutes)`);
      } else {
        console.log(`Disk cache expired for ${site}, will fetch fresh data`);
      }
    } catch (error) {
      console.log(`No valid disk cache found for ${site}, will fetch fresh data`);
    }
  }

  private async saveCacheToDisk(site: string): Promise<void> {
    const cache = this.caches.get(site);
    if (!cache) return;
    
    try {
      const serialized: SerializedCache = {
        tags: Array.from(cache.tags.entries()),
        lastFetch: cache.lastFetch,
      };
      
      const cacheFile = this.getCacheFilePath(site);
      await fs.writeFile(cacheFile, JSON.stringify(serialized));
      console.log(`Saved ${cache.tags.size} tags to disk cache for ${site} at ${cacheFile}`);
    } catch (error) {
      console.error(`Failed to save cache to disk for ${site}:`, error);
    }
  }

  async ensureCache(site: string): Promise<void> {
    // Wait for initial load from disk if still in progress
    const loadPromise = this.loadPromises.get(site);
    if (loadPromise) {
      await loadPromise;
      this.loadPromises.delete(site);
    } else if (!this.caches.has(site)) {
      // First time accessing this site's cache
      const promise = this.loadCacheFromDisk(site);
      this.loadPromises.set(site, promise);
      await promise;
      this.loadPromises.delete(site);
    }

    const now = Date.now();
    const cache = this.caches.get(site);
    
    if (cache && (now - cache.lastFetch) < this.CACHE_DURATION) {
      return;
    }

    // If already fetching, wait for that fetch to complete
    const fetchPromise = this.fetchPromises.get(site);
    if (fetchPromise) {
      return fetchPromise;
    }

    const promise = this.fetchTags(site);
    this.fetchPromises.set(site, promise);
    await promise;
    this.fetchPromises.delete(site);
  }

  private async fetchTags(site: string): Promise<void> {
    try {
      let url: string;
      let headers: HeadersInit = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      if (site === 'yande.re') {
        url = 'https://yande.re/tag.json?limit=0';
      } else if (site === 'konachan.com') {
        url = 'https://konachan.com/tag.json?limit=0';
      } else {
        throw new Error(`Unsupported site: ${site}`);
      }

      console.log(`Fetching ${site} tags from API...`);
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.status}`);
      }

      const tags: Tag[] = await response.json();
      const tagMap = new Map<string, Tag>();
      
      for (const tag of tags) {
        tagMap.set(tag.name, tag);
      }

      this.caches.set(site, {
        tags: tagMap,
        lastFetch: Date.now(),
      });

      console.log(`Fetched and cached ${tagMap.size} tags from ${site} API`);
      
      // Save to disk after successful fetch
      await this.saveCacheToDisk(site);
    } catch (error) {
      console.error(`Error fetching tags for ${site}:`, error);
      // Keep existing cache if fetch fails
      if (!this.caches.get(site)) {
        throw error;
      }
    }
  }

  async getTagsInfo(site: string, tagNames: string[]): Promise<{
    tags: Record<string, { count: number; type: number; color: string } | null>;
    grouped: Record<string, string[]>;
  }> {
    await this.ensureCache(site);
    
    const cache = this.caches.get(site);
    if (!cache) {
      throw new Error(`Tag cache not available for ${site}`);
    }

    const tags: Record<string, { count: number; type: number; color: string } | null> = {};
    const grouped: Record<string, string[]> = {};
    
    // Get the appropriate color and type name mappings for the site
    const TAG_COLORS = site === 'konachan.com' ? KONACHAN_TAG_COLORS : YANDERE_TAG_COLORS;
    const TAG_TYPE_NAMES = site === 'konachan.com' ? KONACHAN_TAG_TYPE_NAMES : YANDERE_TAG_TYPE_NAMES;
    
    // Initialize groups
    for (const typeNum in TAG_TYPE_NAMES) {
      grouped[TAG_TYPE_NAMES[typeNum as unknown as number]] = [];
    }
    grouped['Unknown'] = [];
    
    for (const tagName of tagNames) {
      const tag = cache.tags.get(tagName);
      if (tag) {
        tags[tagName] = {
          count: tag.count,
          type: tag.type,
          color: TAG_COLORS[tag.type] || '#888888',
        };
        
        // Add to grouped structure
        const typeName = TAG_TYPE_NAMES[tag.type] || 'Unknown';
        grouped[typeName].push(tagName);
      } else {
        tags[tagName] = null;
        grouped['Unknown'].push(tagName);
      }
    }
    
    // Remove empty groups
    for (const key in grouped) {
      if (grouped[key].length === 0) {
        delete grouped[key];
      }
    }

    return { tags, grouped };
  }
}

export const tagCacheManager = new TagCacheManager();
export { YANDERE_TAG_COLORS, KONACHAN_TAG_COLORS, YANDERE_TAG_TYPE_NAMES, KONACHAN_TAG_TYPE_NAMES };