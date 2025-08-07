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

const TAG_COLORS: Record<number, string> = {
  0: '#ffaaae', // General
  1: '#cccc00', // Artist
  3: '#D0D',    // Copyright
  4: '#0A0',    // Character
  5: '#0bb',    // Circle
  6: '#FF2020', // Faults
};

class TagCacheManager {
  private cache: TagCache | null = null;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private fetchPromise: Promise<void> | null = null;

  async ensureCache(): Promise<void> {
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
      console.log('Fetching yande.re tags...');
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

      console.log(`Cached ${tagMap.size} tags from yande.re`);
    } catch (error) {
      console.error('Error fetching tags:', error);
      // Keep existing cache if fetch fails
      if (!this.cache) {
        throw error;
      }
    }
  }

  async getTagsInfo(tagNames: string[]): Promise<Record<string, { count: number; type: number; color: string } | null>> {
    await this.ensureCache();
    
    if (!this.cache) {
      throw new Error('Tag cache not available');
    }

    const result: Record<string, { count: number; type: number; color: string } | null> = {};
    
    for (const tagName of tagNames) {
      const tag = this.cache.tags.get(tagName);
      if (tag) {
        result[tagName] = {
          count: tag.count,
          type: tag.type,
          color: TAG_COLORS[tag.type] || '#888888',
        };
      } else {
        result[tagName] = null;
      }
    }

    return result;
  }
}

export const tagCacheManager = new TagCacheManager();
export { TAG_COLORS };