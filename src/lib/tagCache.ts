import fs from 'fs/promises';
import path from 'path';
import { SaxesParser } from 'saxes';
import { gunzipSync } from 'zlib';

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
  // For e621: alias map from antecedent_name -> consequent_name (only active)
  aliases?: Map<string, string>;
}

interface CacheMeta {
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
  5: '#C62828', // Style - dark red
  6: '#1565C0', // Circle - medium blue
};

const GELBOORU_TAG_COLORS: Record<number, string> = {
  0: '#8B5A3C', // General - brown/sienna (similar to moebooru)
  1: '#B8860B', // Artist - dark goldenrod (similar to moebooru)
  2: '#C62828', // Deprecated - dark red (like yandere faults)
  3: '#8B4789', // Copyright - dark orchid (similar to moebooru)
  4: '#2E7D32', // Character - forest green (similar to moebooru)
  5: '#1565C0', // Metadata - medium blue (like konachan styles)
  6: '#C62828', // Deprecated - dark red (like yandere faults)
};

// Rule34 shares tag semantics similar to Gelbooru but exposes
// human-readable type strings via its autocomplete endpoint.
// We'll map those types to numeric codes aligned with Gelbooru's scheme
// for consistent coloring and grouping.
const RULE34_TYPE_TO_NUM: Record<string, number> = {
  'general': 0,
  'artist': 1,
  'copyright': 3,
  'character': 4,
  'metadata': 5,
};

const RULE34_TAG_COLORS: Record<number, string> = {
  0: '#8B5A3C', // General
  1: '#B8860B', // Artist
  3: '#8B4789', // Copyright
  4: '#2E7D32', // Character
  5: '#1565C0', // Metadata
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

const GELBOORU_TAG_TYPE_NAMES: Record<number, string> = {
  0: 'General',
  1: 'Artist',
  2: 'Deprecated',
  3: 'Copyright',
  4: 'Character',
  5: 'Metadata',
  6: 'Deprecated',
};

const E621_TAG_COLORS: Record<number, string> = {
  0: '#8B5A3C', // General
  1: '#B8860B', // Artist
  3: '#8B4789', // Copyright
  4: '#2E7D32', // Character
  5: '#00897B', // Species (teal)
  6: '#9E9E9E', // Invalid (grey)
  7: '#1565C0', // Meta
  8: '#7E57C2', // Lore (purple)
};

const E621_TAG_TYPE_NAMES: Record<number, string> = {
  0: 'General',
  1: 'Artist',
  3: 'Copyright',
  4: 'Character',
  5: 'Species',
  6: 'Invalid',
  7: 'Meta',
  8: 'Lore',
};

class TagCacheManager { 
  // Progress tracking for SSE
  private progressBytes: Map<string, number> = new Map();
  private listeners: Map<string, Set<(data: { site: string; bytes: number; inProgress: boolean; phase?: 'start' | 'progress' | 'done' | 'error' }) => void>> = new Map();

  private emitProgress(site: string, data: { bytes: number; inProgress: boolean; phase?: 'start' | 'progress' | 'done' | 'error' }) {
    const set = this.listeners.get(site);
    if (set && set.size) {
      for (const cb of set) {
        try { cb({ site, ...data }); } catch {}
      }
    }
  }

  subscribeProgress(site: string, cb: (data: { site: string; bytes: number; inProgress: boolean; phase?: 'start' | 'progress' | 'done' | 'error' }) => void): () => void {
    let set = this.listeners.get(site);
    if (!set) {
      set = new Set();
      this.listeners.set(site, set);
    }
    set.add(cb);
    return () => {
      const s = this.listeners.get(site);
      if (!s) return;
      s.delete(cb);
      if (s.size === 0) this.listeners.delete(site);
    };
  }

  getDownloadedBytes(site: string): number {
    return this.progressBytes.get(site) || 0;
  }

  private startProgress(site: string) {
    this.progressBytes.set(site, 0);
    this.emitProgress(site, { bytes: 0, inProgress: true, phase: 'start' });
  }

  private bumpProgress(site: string, n: number) {
    const cur = this.progressBytes.get(site) || 0;
    const next = cur + (n | 0);
    this.progressBytes.set(site, next);
    this.emitProgress(site, { bytes: next, inProgress: true, phase: 'progress' });
  }

  private endProgress(site: string, errored = false) {
    const bytes = this.progressBytes.get(site) || 0;
    this.emitProgress(site, { bytes, inProgress: false, phase: errored ? 'error' : 'done' });
  }

  private async downloadToBuffer(response: Response, site: string): Promise<Buffer> {
    const reader = (response.body as any)?.getReader?.();
    if (!reader) {
      const ab = await response.arrayBuffer();
      const buf = Buffer.from(ab);
      this.bumpProgress(site, buf.length);
      return buf;
    }
    const bufs: Buffer[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const b = Buffer.from(value);
        total += b.length;
        bufs.push(b);
        this.bumpProgress(site, b.length);
      }
    }
    return Buffer.concat(bufs, total);
  }

  // Ensure in-memory cache is populated from disk without network fetches
  public async ensureCacheLoadedFromDisk(site: string): Promise<void> {
    // If already loaded, nothing to do
    if (this.caches.has(site)) return;

    // Reuse loadPromises to avoid duplicate loads
    let loadPromise = this.loadPromises.get(site);
    if (!loadPromise) {
      loadPromise = this.loadCacheFromDisk(site);
      this.loadPromises.set(site, loadPromise);
    }
    try {
      await loadPromise;
    } finally {
      this.loadPromises.delete(site);
    }
  }

  // Returns basic cache stats without triggering network fetches
  async getCacheStats(site: string): Promise<{ hasCache: boolean; fresh: boolean; size: number; lastFetch: number | null; inProgress: boolean; }> {
    // If a disk load is in progress, wait
    const loadPromise = this.loadPromises.get(site);
    if (loadPromise) {
      await loadPromise;
    } else if (!this.caches.has(site)) {
      // Attempt to load from disk if not present in memory
      const promise = this.loadCacheFromDisk(site);
      this.loadPromises.set(site, promise);
      await promise;
      this.loadPromises.delete(site);
    }

    const cache = this.caches.get(site) || null;
    const fresh = this.isCacheFresh(site);
    const size = cache ? cache.tags.size : 0;
    const lastFetch = cache ? cache.lastFetch : null;
    const inProgress = this.fetchPromises.has(site);

    return { hasCache: !!cache, fresh, size, lastFetch, inProgress };
  }

  private caches: Map<string, TagCache | null> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (default)
  private readonly R34_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days for Rule34
  private fetchPromises: Map<string, Promise<void>> = new Map();
  private loadPromises: Map<string, Promise<void>> = new Map();
  private readonly DATA_DIR = path.join(process.cwd(), 'data');

  constructor() {
    this.ensureDataDir();
  }

  private getCacheDuration(site: string): number {
    return site === 'rule34.xxx' ? this.R34_CACHE_DURATION : this.CACHE_DURATION;
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.DATA_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  private getSanitizedSite(site: string): string {
    return site.replace(/[^a-z0-9]/gi, '_');
  }

  private getTagsCsvPath(site: string): string {
    const sanitized = this.getSanitizedSite(site);
    return path.join(this.DATA_DIR, `${sanitized}_tags.csv`);
  }

  private getMetaJsonPath(site: string): string {
    const sanitized = this.getSanitizedSite(site);
    return path.join(this.DATA_DIR, `${sanitized}_tag_meta.json`);
  }

  private getAliasesCsvPath(site: string): string {
    const sanitized = this.getSanitizedSite(site);
    return path.join(this.DATA_DIR, `${sanitized}_aliases.csv`);
  }

  private async loadCacheFromDisk(site: string): Promise<void> {
    try {
      const metaPath = this.getMetaJsonPath(site);
      const metaText = await fs.readFile(metaPath, 'utf-8');
      const meta: CacheMeta = JSON.parse(metaText);

      const now = Date.now();
      const duration = this.getCacheDuration(site);
      if (!meta || typeof meta.lastFetch !== 'number' || (now - meta.lastFetch) >= duration) {
        this.caches.set(site, null);
        console.debug(`Disk cache expired for ${site}, will fetch fresh data`);
        return;
      }

      const tagsPath = this.getTagsCsvPath(site);
      const tagsText = await fs.readFile(tagsPath, 'utf-8');
      const tagMap = new Map<string, Tag>();
      const lines = tagsText.split(/\r?\n/);
      if (lines.length > 0) {
        const header = (lines[0] || '').trim().toLowerCase();
        if (!/id,\s*name,\s*count,\s*type,\s*ambiguous/.test(header)) {
          console.warn('Unexpected tags CSV header for', site, ':', header);
        }
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          const parts = line.split(',');
          if (parts.length < 5) continue;
          const id = parseInt(parts[0], 10) || 0;
          const name = parts[1];
          const count = parseInt(parts[2], 10) || 0;
          const type = parseInt(parts[3], 10) || 0;
          const ambiguous = String(parts[4]).trim() === 'true';
          if (!name || count <= 0) continue;
          tagMap.set(name, { id, name, count, type, ambiguous });
        }
      }

      let aliases: Map<string, string> | undefined = undefined;
      if (site === 'e621.net') {
        try {
          const aliasPath = this.getAliasesCsvPath(site);
          const aliasText = await fs.readFile(aliasPath, 'utf-8');
          const aliasLines = aliasText.split(/\r?\n/);
          if (aliasLines.length > 0) {
            const headerA = (aliasLines[0] || '').trim().toLowerCase();
            if (!/antecedent,\s*consequent/.test(headerA)) {
              console.warn('Unexpected aliases CSV header for', site, ':', headerA);
            }
            const map = new Map<string, string>();
            for (let i = 1; i < aliasLines.length; i++) {
              const line = aliasLines[i];
              if (!line) continue;
              const parts = line.split(',');
              if (parts.length < 2) continue;
              const antecedent = (parts[0] || '').trim();
              const consequent = (parts[1] || '').trim();
              if (!antecedent || !consequent) continue;
              map.set(antecedent, consequent);
            }
            if (map.size > 0) aliases = map;
          }
        } catch {
          // Missing aliases file is acceptable
        }
      }

      this.caches.set(site, {
        tags: tagMap,
        lastFetch: meta.lastFetch,
        aliases,
      });
      console.debug(`Loaded ${tagMap.size} tags from CSV cache for ${site} (age: ${Math.round((now - meta.lastFetch) / 1000 / 60)} minutes)`);
    } catch {
      // Mark as checked to avoid repeated disk reads/logs
      this.caches.set(site, null);
      console.debug(`No valid disk cache found for ${site}, will fetch fresh data`);
    }
  }

  private async saveCacheToDisk(site: string): Promise<void> {
    const cache = this.caches.get(site);
    if (!cache) return;

    try {
      // Write tags CSV
      const tagsCsvPath = this.getTagsCsvPath(site);
      const header = 'id,name,count,type,ambiguous\n';
      const lines: string[] = [];
      for (const [name, tag] of cache.tags) {
        // name should not contain commas in our datasets; write as-is
        lines.push(`${tag.id},${name},${tag.count},${tag.type},${tag.ambiguous ? 'true' : 'false'}`);
      }
      await fs.writeFile(tagsCsvPath, header + lines.join('\n'));

      // For e621, write aliases CSV separately if present
      if (site === 'e621.net') {
        const aliasPath = this.getAliasesCsvPath(site);
        if (cache.aliases && cache.aliases.size > 0) {
          const aliasLines: string[] = ['antecedent,consequent'];
          for (const [antecedent, consequent] of cache.aliases) {
            aliasLines.push(`${antecedent},${consequent}`);
          }
          await fs.writeFile(aliasPath, aliasLines.join('\n'));
        } else {
          // If no aliases, ensure old file does not mislead; best-effort remove
          try { await fs.unlink(aliasPath); } catch {}
        }
      }

      // Write metadata JSON (shared lastFetch)
      const metaPath = this.getMetaJsonPath(site);
      const meta: CacheMeta = { lastFetch: cache.lastFetch };
      await fs.writeFile(metaPath, JSON.stringify(meta));

      console.log(`Saved ${cache.tags.size} tags to CSV cache for ${site}`);
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
    const duration = this.getCacheDuration(site);
    
    if (cache && (now - cache.lastFetch) < duration) {
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

  // Public helper to check if a cache is loaded and fresh
  isCacheFresh(site: string): boolean {
    const cache = this.caches.get(site);
    if (!cache) return false;
    const now = Date.now();
    const duration = this.getCacheDuration(site);
    return (now - cache.lastFetch) < duration;
  }

  // Fire-and-forget refresh for large sources (like Rule34) to avoid blocking requests
  refreshInBackground(site: string): void {
    if (this.fetchPromises.has(site)) return;
    const promise = this.fetchTags(site).catch(err => {
      console.error(`Background refresh failed for ${site}:`, err);
    });
    this.fetchPromises.set(site, promise);
    promise.finally(() => this.fetchPromises.delete(site));
  }

  private async fetchTags(site: string): Promise<void> {
    let __progressStarted = false;
    let __errored = false;
    try {
      this.startProgress(site);
      __progressStarted = true;
      let url: string;
      const headers: HeadersInit = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      if (site === 'yande.re') {
        url = 'https://yande.re/tag.json?limit=0';
        console.log(`Fetching ${site} tags from API...`);
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch tags: ${response.status}`);
        }
        // Stream download to track bytes
        const buf = await this.downloadToBuffer(response, site);
        const text = buf.toString('utf8');
        const tags: Tag[] = JSON.parse(text);
        const tagMap = new Map<string, Tag>();
        for (const tag of tags) {
          tagMap.set(tag.name, tag);
        }
        this.caches.set(site, {
          tags: tagMap,
          lastFetch: Date.now(),
        });
        console.log(`Fetched and cached ${tagMap.size} tags from ${site} API`);
        await this.saveCacheToDisk(site);
        return;
      } else if (site === 'konachan.com') {
        url = 'https://konachan.com/tag.json?limit=0';
        console.log(`Fetching ${site} tags from API...`);
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch tags: ${response.status}`);
        }
        // Stream download to track bytes
        const buf = await this.downloadToBuffer(response, site);
        const text = buf.toString('utf8');
        const tags: Tag[] = JSON.parse(text);
        const tagMap = new Map<string, Tag>();
        for (const tag of tags) {
          tagMap.set(tag.name, tag);
        }
        this.caches.set(site, {
          tags: tagMap,
          lastFetch: Date.now(),
        });
        console.log(`Fetched and cached ${tagMap.size} tags from ${site} API`);
        await this.saveCacheToDisk(site);
        return;
      } else if (site === 'e621.net') {
        // Fetch daily CSV dump: tags-YYYY-MM-DD.csv.gz (UTC)
        const now = new Date();
        const toYMD = (d: Date) => {
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, '0');
          const day = String(d.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        const tryDates = [toYMD(now), toYMD(new Date(now.getTime() - 24*60*60*1000))];
        let success = false;
        const tagMap = new Map<string, Tag>();
        for (const dateStr of tryDates) {
          url = `https://e621.net/db_export/tags-${dateStr}.csv.gz`;
          console.log(`Fetching ${site} tags dump for ${dateStr}...`);
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'uwuviewer/1.0 (by anonymous, https://github.com/uwuviewer)'
            }
          });
          if (!res.ok) {
            console.warn(`Failed to fetch ${url}: ${res.status}`);
            continue;
          }
          const buf = await this.downloadToBuffer(res, site);
          let csv: string;
          try {
            const decompressed = gunzipSync(buf);
            csv = decompressed.toString('utf8');
          } catch (e) {
            console.error('Failed to gunzip e621 tags dump:', e);
            continue;
          }
          const lines = csv.split(/\r?\n/);
          if (lines.length === 0) continue;
          // Expect header: id,name,category,post_count
          const header = lines[0].trim();
          if (!/id,\s*name,\s*category,\s*post_count/.test(header)) {
            console.warn('Unexpected e621 tags header:', header);
          }
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            // Simple CSV parser: fields do not contain commas in this dataset
            const parts = line.split(',');
            if (parts.length < 4) continue;
            const id = parseInt(parts[0], 10) || 0;
            const name = parts[1];
            const category = parseInt(parts[2], 10) || 0;
            const count = parseInt(parts[3], 10) || 0;
            // Skip empty names and zero-count tags
            if (!name || count <= 0) continue;
            tagMap.set(name, { id, name, count, type: category, ambiguous: false });
          }
          success = true;
          break;
        }
        if (!success) {
          throw new Error('Failed to download any e621 tags dump for today or yesterday');
        }
        // Fetch aliases dump as well: tag_aliases-YYYY-MM-DD.csv.gz (UTC)
        let aliasSuccess = false;
        const aliasMap = new Map<string, string>();
        for (const dateStr of tryDates) {
          url = `https://e621.net/db_export/tag_aliases-${dateStr}.csv.gz`;
          console.log(`Fetching ${site} tag aliases dump for ${dateStr}...`);
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'uwuviewer/1.0 (by anonymous, https://github.com/uwuviewer)'
            }
          });
          if (!res.ok) {
            console.warn(`Failed to fetch ${url}: ${res.status}`);
            continue;
          }
          const buf = await this.downloadToBuffer(res, site);
          let csv: string;
          try {
            const decompressed = gunzipSync(buf);
            csv = decompressed.toString('utf8');
          } catch (e) {
            console.error('Failed to gunzip e621 tag aliases dump:', e);
            continue;
          }
          const lines = csv.split(/\r?\n/);
          if (lines.length === 0) continue;
          // Expect header: id,antecedent_name,consequent_name,created_at,status
          const header = lines[0].trim();
          if (!/id,\s*antecedent_name,\s*consequent_name,\s*created_at,\s*status/.test(header)) {
            console.warn('Unexpected e621 tag_aliases header:', header);
          }
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 5) continue;
            const antecedent = (parts[1] || '').trim();
            const consequent = (parts[2] || '').trim();
            const status = (parts[4] || '').trim();
            if (!antecedent || !consequent) continue;
            if (status && status !== 'active') continue;
            aliasMap.set(antecedent, consequent);
          }
          aliasSuccess = true;
          break;
        }
        if (!aliasSuccess) {
          console.warn('Failed to download e621 tag aliases dump for today or yesterday');
        }
        this.caches.set(site, {
          tags: tagMap,
          lastFetch: Date.now(),
          aliases: aliasMap.size > 0 ? aliasMap : undefined,
        });
        console.log(`Fetched and cached ${tagMap.size} tags and ${aliasMap.size} aliases from ${site} dump`);
        await this.saveCacheToDisk(site);
        return;
      } else if (site === 'rule34.xxx') {
        url = 'https://api.rule34.xxx/index.php?page=dapi&s=tag&q=index&limit=0';
        console.log(`Fetching ${site} tags (streaming XML)...`);
        const response = await fetch(url, { headers });
        if (!response.ok || !response.body) {
          throw new Error(`Failed to fetch tags: ${response.status}`);
        }
        const tagMap = new Map<string, Tag>();

        const parser = new SaxesParser();
        parser.on('error', (e: any) => {
          console.error(`XML parse error for ${site}:`, e?.message || e);
          // swallow to continue parsing subsequent chunks
        });
        const sanitizeXmlChunk = (chunk: string): string => {
          // Remove characters not allowed in XML 1.0
          // Allowed: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD]
          return chunk.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, '');
        };
        parser.on('opentag', (node: any) => {
          if (!node || !node.name) return;
          const name = String(node.name).toLowerCase();
          if (name !== 'tag') return;
          const attrs = node.attributes || {};
          const tagName = String(attrs.name || '');
          if (!tagName) return;
          const count = parseInt(String(attrs.count || '0'), 10) || 0;
          if (count <= 0) return;
          let typeNum: number;
          const typeAttr = String(attrs.type ?? '0');
          if (/^\d+$/.test(typeAttr)) {
            typeNum = parseInt(typeAttr, 10);
          } else {
            typeNum = RULE34_TYPE_TO_NUM[typeAttr.toLowerCase()] ?? 0;
          }
          const id = parseInt(String(attrs.id || '0'), 10) || 0;
          const ambiguous = String(attrs.ambiguous || 'false') === 'true';
          tagMap.set(tagName, { id, name: tagName, count, type: typeNum, ambiguous });
        });

        const reader = (response.body as any).getReader?.();
        if (!reader) {
           // Fallback: load entire text (may be heavy); try to parse anyway
            const text = await response.text();
            this.bumpProgress(site, Buffer.byteLength(text, 'utf8'));           const sanitized = text.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, '');
           try {
             parser.write(sanitized);
           } catch (e) {
             console.error(`Parser write failed for ${site}:`, e);
           }
           parser.close();        } else {
          const decoder = new TextDecoder();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) this.bumpProgress(site, value.byteLength);
            const decoded = decoder.decode(value, { stream: true });
            const sanitized = sanitizeXmlChunk(decoded);
            try {
              parser.write(sanitized);
            } catch (e) {
              console.error(`Parser write failed for ${site}:`, e);
            }
          }
          parser.close();
        }

        this.caches.set(site, {
          tags: tagMap,
          lastFetch: Date.now(),
        });
        console.log(`Fetched and cached ${tagMap.size} tags from ${site} XML`);
        await this.saveCacheToDisk(site);
        return;
      } else {
        throw new Error(`Unsupported site: ${site}`);
      }
    } catch (error) {
      console.error(`Error fetching tags for ${site}:`, error);
      __errored = true;
      // Keep existing cache if fetch fails
      if (!this.caches.get(site)) {
        throw error;
      }
    } finally {
      if (__progressStarted) this.endProgress(site, __errored);
    }
  }

  // Cache-only search that NEVER triggers network fetches
  searchCachedTagsOnly(site: string, query: string, limit: number = 10): Tag[] {
    const cache = this.caches.get(site);
    if (!cache) return [];

    const lowerQuery = query.toLowerCase();
    const results: Tag[] = [];
    for (const [name, tag] of cache.tags) {
      if (tag.count <= 0) continue;
      if (name.toLowerCase().startsWith(lowerQuery)) {
        results.push(tag);
      }
    }
    return results
      .sort((a, b) => {
        const aExact = a.name.toLowerCase() === lowerQuery;
        const bExact = b.name.toLowerCase() === lowerQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return b.count - a.count;
      })
      .slice(0, limit);
  }

  // For e621: search aliases only, returning pairs of (alias, target Tag)
  searchE621AliasesOnly(query: string, limit: number = 10): Array<{ alias: string; target: Tag }>
  {
    const cache = this.caches.get('e621.net');
    if (!cache || !cache.aliases) return [];
    const lowerQuery = query.toLowerCase();
    const out: Array<{ alias: string; target: Tag }> = [];
    for (const [alias, consequent] of cache.aliases) {
      if (!alias || !consequent) continue;
      if (!alias.toLowerCase().startsWith(lowerQuery)) continue;
      const target = cache.tags.get(consequent);
      if (target && target.count > 0) {
        out.push({ alias, target });
      }
    }
    return out
      .sort((a, b) => {
        const aExact = a.alias.toLowerCase() === lowerQuery;
        const bExact = b.alias.toLowerCase() === lowerQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return b.target.count - a.target.count;
      })
      .slice(0, limit);
  }

  async searchCachedTags(site: string, query: string, limit: number = 10): Promise<Tag[]> {
    if (site !== 'yande.re' && site !== 'konachan.com' && site !== 'rule34.xxx' && site !== 'e621.net') {
      return [];
    }
    
    await this.ensureCache(site);
    
    const cache = this.caches.get(site);
    if (!cache) {
      return [];
    }
    
    const lowerQuery = query.toLowerCase();
    const results: Tag[] = [];
    
    // Search through ALL cached tags that match
    for (const [name, tag] of cache.tags) {
      if (tag.count <= 0) continue;
      if (name.toLowerCase().startsWith(lowerQuery)) {
        results.push(tag);
      }
    }
    
    // Sort by relevance: exact match first, then by count
    return results
      .sort((a, b) => {
        // Exact match gets highest priority
        const aExact = a.name.toLowerCase() === lowerQuery;
        const bExact = b.name.toLowerCase() === lowerQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Then sort by count (descending)
        return b.count - a.count;
      })
      .slice(0, limit);
  }

  async getTagsInfo(site: string, tagNames: string[], apiKey?: string): Promise<{
    tags: Record<string, { count: number; type: number; color: string } | null>;
    grouped: Record<string, string[]>;
  }> {
    // Handle Gelbooru separately since it doesn't use cache
    if (site === 'gelbooru.com') {
      return this.getGelbooruTagsInfo(tagNames, apiKey);
    }
    // Handle Rule34 via its autocomplete API
    if (site === 'rule34.xxx') {
      return this.getRule34TagsInfo(tagNames);
    }
    
    // Do NOT trigger network fetches here; only use cache if present
    // But make sure we load from disk if available
    await this.ensureCacheLoadedFromDisk(site);
    const cache = this.caches.get(site);
    if (!cache) {
      // Return all unknowns when cache is not yet ready
      const emptyTags: Record<string, { count: number; type: number; color: string } | null> = {};
      const emptyGrouped: Record<string, string[]> = { Unknown: [...tagNames] };
      return { tags: emptyTags, grouped: emptyGrouped };
    }

    const tags: Record<string, { count: number; type: number; color: string } | null> = {};
    const grouped: Record<string, string[]> = {};
    
    // Get the appropriate color and type name mappings for the site
    const TAG_COLORS = site === 'konachan.com' ? KONACHAN_TAG_COLORS : site === 'e621.net' ? E621_TAG_COLORS : YANDERE_TAG_COLORS;
    const TAG_TYPE_NAMES = site === 'konachan.com' ? KONACHAN_TAG_TYPE_NAMES : site === 'e621.net' ? E621_TAG_TYPE_NAMES : YANDERE_TAG_TYPE_NAMES;
    
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

  private async getRule34TagsInfo(tagNames: string[]): Promise<{
    tags: Record<string, { count: number; type: number; color: string } | null>;
    grouped: Record<string, string[]>;
  }> {
    const tags: Record<string, { count: number; type: number; color: string } | null> = {};
    const grouped: Record<string, string[]> = {};

    const RULE34_TYPE_NAMES: Record<number, string> = {
      0: 'General',
      1: 'Artist',
      3: 'Copyright',
      4: 'Character',
      5: 'Metadata',
    };

    // Initialize groups
    for (const typeNum in RULE34_TYPE_NAMES) {
      grouped[RULE34_TYPE_NAMES[typeNum as unknown as number]] = [];
    }
    grouped['Unknown'] = [];

    // If cache is not ready, first try to load from disk; do NOT trigger downloads here
    await this.ensureCacheLoadedFromDisk('rule34.xxx');
    const cache = this.caches.get('rule34.xxx');
    if (!cache) {
      for (const tagName of tagNames) {
        tags[tagName] = null;
        grouped['Unknown'].push(tagName);
      }
    } else {
      for (const tagName of tagNames) {
        const tag = cache.tags.get(tagName);
        if (tag) {
          const color = RULE34_TAG_COLORS[tag.type] || '#888888';
          tags[tagName] = { count: tag.count, type: tag.type, color };
          grouped[RULE34_TYPE_NAMES[tag.type]].push(tagName);
        } else {
          tags[tagName] = null;
          grouped['Unknown'].push(tagName);
        }
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

  private async getGelbooruTagsInfo(tagNames: string[], apiKey?: string): Promise<{
    tags: Record<string, { count: number; type: number; color: string } | null>;
    grouped: Record<string, string[]>;
  }> {
    const tags: Record<string, { count: number; type: number; color: string } | null> = {};
    const grouped: Record<string, string[]> = {};
    
    // Initialize groups
    for (const typeNum in GELBOORU_TAG_TYPE_NAMES) {
      grouped[GELBOORU_TAG_TYPE_NAMES[typeNum as unknown as number]] = [];
    }
    grouped['Unknown'] = [];
    
    try {
      // Gelbooru API allows fetching multiple tags at once
      const tagNamesParam = tagNames.join(' ');
      const apiKeyParam = apiKey || '';
      const url = `https://gelbooru.com/index.php?page=dapi&s=tag&q=index&names=${encodeURIComponent(tagNamesParam)}&json=1${apiKeyParam}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tags from Gelbooru: ${response.status}`);
      }
      
      const data = await response.json();
      const fetchedTags = data.tag || [];
      
      // Create a map of fetched tags for quick lookup
      const fetchedTagMap = new Map<string, any>();
      for (const tag of fetchedTags) {
        fetchedTagMap.set(tag.name, tag);
      }
      
      // Process each requested tag
      for (const tagName of tagNames) {
        const tag = fetchedTagMap.get(tagName);
        if (tag) {
          tags[tagName] = {
            count: tag.count,
            type: tag.type,
            color: GELBOORU_TAG_COLORS[tag.type] || '#888888',
          };
          
          // Add to grouped structure
          const typeName = GELBOORU_TAG_TYPE_NAMES[tag.type] || 'Unknown';
          grouped[typeName].push(tagName);
        } else {
          tags[tagName] = null;
          grouped['Unknown'].push(tagName);
        }
      }
    } catch (error) {
      console.error('Error fetching Gelbooru tags:', error);
      // If API fails, mark all tags as unknown
      for (const tagName of tagNames) {
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
export { 
  YANDERE_TAG_COLORS, 
  KONACHAN_TAG_COLORS, 
  GELBOORU_TAG_COLORS,
  YANDERE_TAG_TYPE_NAMES, 
  KONACHAN_TAG_TYPE_NAMES,
  GELBOORU_TAG_TYPE_NAMES,
  RULE34_TYPE_TO_NUM,
  RULE34_TAG_COLORS,
  E621_TAG_COLORS,
  E621_TAG_TYPE_NAMES
};
export type { Tag };