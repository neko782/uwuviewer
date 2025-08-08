export interface MoebooruPost {
  id: number;
  tags: string;
  created_at: number;
  creator_id: number;
  author: string;
  change: number;
  source: string;
  score: number;
  md5: string;
  file_size: number;
  file_url: string;
  is_shown_in_index: boolean;
  preview_url: string;
  preview_width: number;
  preview_height: number;
  actual_preview_width: number;
  actual_preview_height: number;
  sample_url: string;
  sample_width: number;
  sample_height: number;
  sample_file_size: number;
  jpeg_url: string;
  jpeg_width: number;
  jpeg_height: number;
  jpeg_file_size: number;
  rating: string;
  has_children: boolean;
  parent_id: number | null;
  status: string;
  width: number;
  height: number;
  is_held: boolean;
  frames_pending_string: string;
  frames_pending: unknown[];
  frames_string: string;
  frames: unknown[];
}

export interface GelbooruPost {
  id: number;
  created_at: string;
  score: number;
  width: number;
  height: number;
  md5: string;
  directory: string;
  image: string;
  rating: string;
  source: string;
  change: number;
  owner: string;
  creator_id: number;
  parent_id: number;
  sample: number;
  preview_height: number;
  preview_width: number;
  tags: string;
  title: string;
  has_notes: string;
  has_comments: string;
  file_url: string;
  preview_url: string;
  sample_url: string;
  sample_height: number;
  sample_width: number;
  status: string;
  post_locked: number;
  has_children: string;
}

export interface GelbooruResponse {
  '@attributes': {
    limit: number;
    offset: number;
    count: number;
  };
  post: GelbooruPost[];
}

export interface UnifiedPost {
  id: number;
  tags: string;
  score: number;
  rating: string;
  file_url: string;
  preview_url: string;
  sample_url: string;
  width: number;
  height: number;
  preview_width: number;
  preview_height: number;
  source: string;
  has_children: boolean;
}

export type Site = 'yande.re' | 'konachan.com' | 'gelbooru.com' | 'rule34.xxx' | 'e621.net';

export class ImageBoardAPI {
  private baseUrl: string;
  private timeout = 60000; // 60 seconds timeout
  private site: Site;
  private apiType: 'moebooru' | 'gelbooru' | 'e621';
  private apiKey: string;
  private e621Login?: string;
  private e621ApiKey?: string;

  constructor(site: Site = 'yande.re', apiKey: string = '', e621Auth?: { login?: string; apiKey?: string }) {
    this.site = site;
    this.apiKey = apiKey;
    this.e621Login = e621Auth?.login || '';
    this.e621ApiKey = e621Auth?.apiKey || '';
    
    // Rule34 does not use an API key
    if (site === 'rule34.xxx') {
      this.apiKey = '';
    }
    
    if (site === 'gelbooru.com') {
      this.baseUrl = 'https://gelbooru.com';
      this.apiType = 'gelbooru';
    } else if (site === 'rule34.xxx') {
      this.baseUrl = 'https://rule34.xxx';
      this.apiType = 'gelbooru';
    } else if (site === 'e621.net') {
      this.baseUrl = 'https://e621.net';
      this.apiType = 'e621';
    } else {
      this.baseUrl = `https://${site}`;
      this.apiType = 'moebooru';
    }
  }

  // Combines an external AbortSignal with an internal timeout-based signal
  private async fetchWithTimeout(url: string, options: RequestInit = {}, externalSignal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      try { controller.abort(); } catch {}
    }, this.timeout);

    const onAbort = () => {
      try { controller.abort(); } catch {}
    };
    if (externalSignal) {
      if (externalSignal.aborted) onAbort();
      else externalSignal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort as any);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort as any);
      if (error && (error.name === 'AbortError' || error.code === 'ABORT_ERR')) {
        if (timedOut) {
          throw new Error('Request timeout - please try again');
        }
        const e = new Error('Request aborted');
        (e as any).name = 'AbortError';
        throw e;
      }
      throw error;
    }
  }

  private convertMoebooruToUnified(post: MoebooruPost): UnifiedPost {
    return {
      id: post.id,
      tags: post.tags,
      score: post.score,
      rating: post.rating,
      file_url: post.file_url,
      preview_url: post.preview_url,
      sample_url: post.sample_url,
      width: post.width,
      height: post.height,
      preview_width: post.preview_width,
      preview_height: post.preview_height,
      source: post.source,
      has_children: post.has_children,
    };
  }

  private convertGelbooruToUnified(post: any): UnifiedPost {
    // Handle Gelbooru/Rule34 different field formats and potential empty values
    return {
      id: Number(post.id),
      tags: post.tags || '',
      score: Number(post.score) || 0,
      rating: this.normalizeGelbooruRating(post.rating),
      file_url: post.file_url || '',
      preview_url: post.preview_url || '',
      // sample_url can be empty string, use file_url as fallback
      sample_url: (post.sample_url && post.sample_url !== '') ? post.sample_url : post.file_url,
      width: Number(post.width) || 0,
      height: Number(post.height) || 0,
      // For Rule34, preview dimensions are not provided; fall back to original dimensions
      preview_width: Number(post.preview_width) || Number(post.width) || 250,
      preview_height: Number(post.preview_height) || Number(post.height) || 250,
      source: post.source || '',
      // has_children might be 'true'/'false', boolean, or missing
      has_children: post.has_children === true || post.has_children === 'true',
    };
  }

  private convertE621ToUnified(post: any): UnifiedPost {
    // E621 post shape per docs
    const tagsArr: string[] = [
      ...(post.tags?.general || []),
      ...(post.tags?.species || []),
      ...(post.tags?.character || []),
      ...(post.tags?.copyright || []),
      ...(post.tags?.artist || []),
      ...(post.tags?.meta || []),
      ...(post.tags?.lore || []),
      ...(post.tags?.invalid || []),
    ];
    const tags = tagsArr.join(' ');
    const scoreTotal = typeof post.score?.total === 'number' ? post.score.total : 0;
    const fileUrl = post.file?.url || '';
    const sampleUrl = post.sample?.url || fileUrl;
    const previewUrl = post.preview?.url || sampleUrl || fileUrl;

    const width = typeof post.file?.width === 'number' ? post.file.width : 0;
    const height = typeof post.file?.height === 'number' ? post.file.height : 0;
    const preview_width = typeof post.preview?.width === 'number' ? post.preview.width : width || 250;
    const preview_height = typeof post.preview?.height === 'number' ? post.preview.height : height || 250;

    const sources: string[] = Array.isArray(post.sources) ? post.sources : [];
    const source = sources.length > 0 ? sources[0] : '';

    const has_children = !!post.relationships?.has_children;

    return {
      id: Number(post.id),
      tags,
      score: scoreTotal,
      rating: String(post.rating || 's'),
      file_url: fileUrl,
      preview_url: previewUrl,
      sample_url: sampleUrl,
      width,
      height,
      preview_width,
      preview_height,
      source,
      has_children,
    };
  }

  private normalizeGelbooruRating(rating: string): string {
    // Gelbooru uses full words for ratings: general, sensitive, questionable, explicit
    if (!rating) return 's';
    
    const lowerRating = rating.toLowerCase();
    
    // Check full words - keep sensitive as its own rating for Gelbooru
    if (lowerRating === 'general' || lowerRating === 'safe') return 's';
    if (lowerRating === 'sensitive') return 'sensitive';
    if (lowerRating === 'questionable') return 'q';
    if (lowerRating === 'explicit') return 'e';
    
    // Fallback to first character
    const firstChar = lowerRating.charAt(0);
    switch(firstChar) {
      case 'g': // general
        return 's';
      case 's': // sensitive or safe - default to sensitive for Gelbooru
        return 'sensitive';
      case 'q': // questionable
        return 'q';
      case 'e': // explicit
        return 'e';
      default:
        return 's';
    }
  }

  private denormalizeRatingForGelbooru(rating: string): string {
    // Convert our standard ratings to Gelbooru format
    // Gelbooru uses "general", "sensitive", "questionable", "explicit"
    const ratingMap: { [key: string]: string } = {
      's': 'general',
      'sensitive': 'sensitive',
      'q': 'questionable',
      'e': 'explicit',
    };
    return ratingMap[rating] || rating;
  }

  async getPosts(
    params: {
      page?: number;
      limit?: number;
      tags?: string;
      rating?: 's' | 'q' | 'e';
    } = {},
    opts?: { signal?: AbortSignal }
  ): Promise<UnifiedPost[]> {
    if (this.apiType === 'gelbooru') {
      return this.getGelbooruPosts(params, opts);
    } else if (this.apiType === 'e621') {
      return this.getE621Posts(params, opts);
    } else {
      return this.getMoebooruPosts(params, opts);
    }
  }

  private async getE621Posts(
    params: {
      page?: number;
      limit?: number;
      tags?: string;
      rating?: 's' | 'q' | 'e';
    },
    opts?: { signal?: AbortSignal }
  ): Promise<UnifiedPost[]> {
    const limit = params.limit || 100;
    const page = params.page || 1;

    const queryParams = new URLSearchParams({
      limit: String(limit),
      page: String(page),
    });
    let tags = params.tags || '';
    if (params.rating) {
      tags = tags ? `${tags} rating:${params.rating}` : `rating:${params.rating}`;
    }
    if (tags) queryParams.append('tags', tags);

    // Append e621 auth if provided
    // Credentials are injected server-side by the proxy from a global store

    // We go through our proxy which sets an appropriate User-Agent for e621
    const url = `/api/proxy?url=${encodeURIComponent(`${this.baseUrl}/posts.json?${queryParams}`)}`;
    const response = await this.fetchWithTimeout(url, {}, opts?.signal);
    if (!response.ok) {
      if (response.status === 401 && this.site === 'gelbooru.com') {
        throw new Error('Unauthorized (401) from Gelbooru — maybe you forgot to set your API key');
      }
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }
    const data: any = await response.json();
    const postsRaw: any[] = Array.isArray(data) ? data : (data?.posts || []);
    return postsRaw.map((p) => this.convertE621ToUnified(p));
  }

  private async getMoebooruPosts(
    params: {
      page?: number;
      limit?: number;
      tags?: string;
      rating?: 's' | 'q' | 'e';
    },
    opts?: { signal?: AbortSignal }
  ): Promise<UnifiedPost[]> {
    const queryParams = new URLSearchParams({
      page: (params.page || 1).toString(),
      limit: (params.limit || 100).toString(),
    });

    if (params.tags) {
      queryParams.append('tags', params.tags);
    }

    if (params.rating) {
      queryParams.append('tags', queryParams.get('tags') 
        ? `${queryParams.get('tags')} rating:${params.rating}`
        : `rating:${params.rating}`);
    }

    const url = `/api/proxy?url=${encodeURIComponent(`${this.baseUrl}/post.json?${queryParams}`)}`;
    const response = await this.fetchWithTimeout(url, {}, opts?.signal);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }

    const posts: MoebooruPost[] = await response.json();
    return posts.map(post => this.convertMoebooruToUnified(post));
  }

  private async getGelbooruPosts(
    params: {
      page?: number;
      limit?: number;
      tags?: string;
      rating?: 's' | 'q' | 'e';
    },
    opts?: { signal?: AbortSignal }
  ): Promise<UnifiedPost[]> {
    const page = params.page || 1;
    const limit = params.limit || 100;
    const pid = (page - 1); // Gelbooru uses pid (page id) starting from 0
    
    const queryParams = new URLSearchParams({
      page: 'dapi',
      s: 'post',
      q: 'index',
      json: '1',
      pid: pid.toString(),
      limit: limit.toString(),
    });

    let tags = params.tags || '';
    if (params.rating) {
      const gelbooruRating = this.denormalizeRatingForGelbooru(params.rating);
      tags = tags ? `${tags} rating:${gelbooruRating}` : `rating:${gelbooruRating}`;
    }
    
    if (tags) {
      queryParams.append('tags', tags);
    }

    // Add API key if provided (format: &api_key=xxx&user_id=yyy). Rule34 never uses an API key.
    const url = `/api/proxy?url=${encodeURIComponent(`${this.baseUrl}/index.php?${queryParams}`)}`;
    const response = await this.fetchWithTimeout(url, {}, opts?.signal);
    
    if (!response.ok) {
      if (response.status === 401 && this.site === 'gelbooru.com') {
        throw new Error('Unauthorized (401) from Gelbooru — maybe you forgot to set your API key');
      }
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }

    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      console.error('Failed to parse Gelbooru/Rule34 response:', e);
      return [];
    }
    
    // Support both shapes:
    // - Gelbooru JSON: { post: [...] }
    // - Rule34 JSON: [ ... ]
    let postsRaw: any[] = [];
    if (Array.isArray(data)) {
      postsRaw = data;
    } else if (data && data.post) {
      postsRaw = Array.isArray(data.post) ? data.post : [data.post];
    }

    if (!postsRaw || postsRaw.length === 0) return [];

    return postsRaw
      .filter((post) => post != null)
      .map((post) => this.convertGelbooruToUnified(post));
  }

  async getPost(id: number): Promise<UnifiedPost> {
    if (this.apiType === 'gelbooru') {
      const queryParams = new URLSearchParams({
        page: 'dapi',
        s: 'post',
        q: 'index',
        json: '1',
        id: id.toString(),
      });

      const url = `/api/proxy?url=${encodeURIComponent(`${this.baseUrl}/index.php?${queryParams}`)}`;
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        if (response.status === 401 && this.site === 'gelbooru.com') {
          throw new Error('Unauthorized (401) from Gelbooru — maybe you forgot to set your API key');
        }
        throw new Error(`Failed to fetch post: ${response.statusText}`);
      }

      const data: any = await response.json();

      // Support both shapes: array (Rule34) or object with post field (Gelbooru)
      let postRaw: any | null = null;
      if (Array.isArray(data)) {
        postRaw = data[0] || null;
      } else if (data && data.post) {
        postRaw = Array.isArray(data.post) ? data.post[0] : data.post;
      }

      if (!postRaw) {
        throw new Error('Post not found');
      }

      return this.convertGelbooruToUnified(postRaw);
    } else {
      const url = `/api/proxy?url=${encodeURIComponent(`${this.baseUrl}/post/show/${id}.json`)}`;
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch post: ${response.statusText}`);
      }

      const post: MoebooruPost = await response.json();
      return this.convertMoebooruToUnified(post);
    }
  }

  async searchTags(query: string): Promise<unknown[]> {
    if (this.apiType === 'gelbooru') {
      const queryParams = new URLSearchParams({
        page: 'dapi',
        s: 'tag',
        q: 'index',
        json: '1',
        name_pattern: `${query}%`,
        limit: '10',
      });

      const url = `/api/proxy?url=${encodeURIComponent(`${this.baseUrl}/index.php?${queryParams}`)}`;
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`Failed to search tags: ${response.statusText}`);
      }

      return response.json();
    } else {
      const url = `/api/proxy?url=${encodeURIComponent(
        `${this.baseUrl}/tag.json?name=${encodeURIComponent(query)}*&limit=10`
      )}`;
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`Failed to search tags: ${response.statusText}`);
      }

      return response.json();
    }
  }
}

// Export for backward compatibility
export class MoebooruAPI extends ImageBoardAPI {
  constructor(_site: Site = 'yande.re') {
    super(_site);
  }
}
