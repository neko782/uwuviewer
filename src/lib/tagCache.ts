import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

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

const TAG_COLORS: Record<number, string> = {
  0: '#8B5A3C', // General - brown/sienna
  1: '#B8860B', // Artist - dark goldenrod
  3: '#8B4789', // Copyright - dark orchid
  4: '#2E7D32', // Character - forest green
  5: '#1565C0', // Circle - medium blue
  6: '#C62828', // Faults - dark red
};

const TAG_TYPE_NAMES: Record<number, string> = {
  0: 'General',
  1: 'Artist',
  3: 'Copyright',
  4: 'Character',
  5: 'Circle',
  6: 'Faults',
};

class TagCacheManager {
  private cache: TagCache | null = null;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private fetchPromise: Promise<void> | null = null;
  private loadPromise: Promise<void> | null = null;
  private readonly CACHE_FILE = path.join(tmpdir(), 'owo-tag-cache.json');

  constructor() {
    this.loadPromise = this.loadCacheFromDisk();
  }

  private async loadCacheFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.CACHE_FILE, 'utf-8');
      const serialized: SerializedCache = JSON.parse(data);
      
      const now = Date.now();
      if (now - serialized.lastFetch < this.CACHE_DURATION) {
        this.cache = {
          tags: new Map(serialized.tags),
          lastFetch: serialized.lastFetch,
        };
        console.log(`Loaded ${this.cache.tags.size} tags from disk cache (age: ${Math.round((now - serialized.lastFetch) / 1000 / 60)} minutes)`);
      } else {
        console.log('Disk cache expired, will fetch fresh data');
      }
    } catch (error) {
      console.log('No valid disk cache found, will fetch fresh data');
    }
  }

  private async saveCacheToDisk(): Promise<void> {
    if (!this.cache) return;
    
    try {
      const serialized: SerializedCache = {
        tags: Array.from(this.cache.tags.entries()),
        lastFetch: this.cache.lastFetch,
      };
      
      await fs.writeFile(this.CACHE_FILE, JSON.stringify(serialized));
      console.log(`Saved ${this.cache.tags.size} tags to disk cache at ${this.CACHE_FILE}`);
    } catch (error) {
      console.error('Failed to save cache to disk:', error);
    }
  }

  async ensureCache(): Promise<void> {
    // Wait for initial load from disk if still in progress
    if (this.loadPromise) {
      await this.loadPromise;
      this.loadPromise = null;
    }

    const now = Date.now();
    
    if (this.cache && (now - this.cache.lastFetch) < this.CACHE_DURATION) {
      return;
    }

    // If already fetching, wait for that fetch to complete
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this.fetchTags();
    await this.fetchPromise;
    this.fetchPromise = null;
  }

  private async fetchTags(): Promise<void> {
    try {
      console.log('Fetching yande.re tags from API...');
      const response = await fetch('https://yande.re/tag.json?limit=0', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.status}`);
      }

      const tags: Tag[] = await response.json();
      const tagMap = new Map<string, Tag>();
      
      for (const tag of tags) {
        tagMap.set(tag.name, tag);
      }

      this.cache = {
        tags: tagMap,
        lastFetch: Date.now(),
      };

      console.log(`Fetched and cached ${tagMap.size} tags from yande.re API`);
      
      // Save to disk after successful fetch
      await this.saveCacheToDisk();
    } catch (error) {
      console.error('Error fetching tags:', error);
      // Keep existing cache if fetch fails
      if (!this.cache) {
        throw error;
      }
    }
  }

  async getTagsInfo(tagNames: string[]): Promise<{
    tags: Record<string, { count: number; type: number; color: string } | null>;
    grouped: Record<string, string[]>;
  }> {
    await this.ensureCache();
    
    if (!this.cache) {
      throw new Error('Tag cache not available');
    }

    const tags: Record<string, { count: number; type: number; color: string } | null> = {};
    const grouped: Record<string, string[]> = {};
    
    // Initialize groups
    for (const typeNum in TAG_TYPE_NAMES) {
      grouped[TAG_TYPE_NAMES[typeNum as unknown as number]] = [];
    }
    grouped['Unknown'] = [];
    
    for (const tagName of tagNames) {
      const tag = this.cache.tags.get(tagName);
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
export { TAG_COLORS, TAG_TYPE_NAMES };
