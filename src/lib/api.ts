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

export type Site = 'yande.re' | 'konachan.com' | 'gelbooru.com';

export class ImageBoardAPI {
  private baseUrl: string;
  private timeout = 60000; // 60 seconds timeout
  private site: Site;
  private apiType: 'moebooru' | 'gelbooru';
  private apiKey: string;

  constructor(site: Site = 'yande.re', apiKey: string = '') {
    this.site = site;
    this.apiKey = apiKey;
    
    if (site === 'gelbooru.com') {
      this.baseUrl = 'https://gelbooru.com';
      this.apiType = 'gelbooru';
    } else {
      this.baseUrl = `https://${site}`;
      this.apiType = 'moebooru';
    }
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - please try again');
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

  private convertGelbooruToUnified(post: GelbooruPost): UnifiedPost {
    // Handle Gelbooru's different field formats and potential empty values
    return {
      id: post.id,
      tags: post.tags || '',
      score: post.score || 0,
      rating: this.normalizeGelbooruRating(post.rating),
      file_url: post.file_url || '',
      preview_url: post.preview_url || '',
      // Gelbooru's sample_url can be empty string, use file_url as fallback
      sample_url: (post.sample_url && post.sample_url !== '') ? post.sample_url : post.file_url,
      width: post.width || 0,
      height: post.height || 0,
      preview_width: post.preview_width || 250,
      preview_height: post.preview_height || 250,
      source: post.source || '',
      // Gelbooru returns has_children as string "true"/"false"
      has_children: post.has_children === 'true',
    };
  }

  private normalizeGelbooruRating(rating: string): string {
    // Gelbooru uses full words for ratings, not single letters
    // From your example: "questionable" instead of "q"
    if (!rating) return 's';
    
    const lowerRating = rating.toLowerCase();
    
    // Check full words first
    if (lowerRating === 'general' || lowerRating === 'safe') return 's';
    if (lowerRating === 'questionable' || lowerRating === 'sensitive') return 'q';
    if (lowerRating === 'explicit') return 'e';
    
    // Fallback to first character
    const firstChar = lowerRating.charAt(0);
    switch(firstChar) {
      case 'g': // general
      case 's': // safe
        return 's';
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
    // Gelbooru uses "general" instead of "safe"
    const ratingMap: { [key: string]: string } = {
      's': 'general',
      'q': 'questionable',
      'e': 'explicit',
    };
    return ratingMap[rating] || rating;
  }

  async getPosts(params: {
    page?: number;
    limit?: number;
    tags?: string;
    rating?: 's' | 'q' | 'e';
  } = {}): Promise<UnifiedPost[]> {
    if (this.apiType === 'gelbooru') {
      return this.getGelbooruPosts(params);
    } else {
      return this.getMoebooruPosts(params);
    }
  }

  private async getMoebooruPosts(params: {
    page?: number;
    limit?: number;
    tags?: string;
    rating?: 's' | 'q' | 'e';
  }): Promise<UnifiedPost[]> {
    const queryParams = new URLSearchParams({
      page: (params.page || 1).toString(),
      limit: (params.limit || 20).toString(),
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
    const response = await this.fetchWithTimeout(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }

    const posts: MoebooruPost[] = await response.json();
    return posts.map(post => this.convertMoebooruToUnified(post));
  }

  private async getGelbooruPosts(params: {
    page?: number;
    limit?: number;
    tags?: string;
    rating?: 's' | 'q' | 'e';
  }): Promise<UnifiedPost[]> {
    const page = params.page || 1;
    const limit = params.limit || 20;
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

    // Add API key if provided (format: &api_key=xxx&user_id=yyy)
    const apiKeyParam = this.apiKey ? this.apiKey : '';
    const url = `/api/proxy?url=${encodeURIComponent(`${this.baseUrl}/index.php?${queryParams}${apiKeyParam}`)}`;
    const response = await this.fetchWithTimeout(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }

    let data: GelbooruResponse;
    try {
      data = await response.json();
    } catch (e) {
      console.error('Failed to parse Gelbooru response:', e);
      return [];
    }
    
    // Handle empty results or missing post field
    if (!data || !data.post) {
      return [];
    }

    // Gelbooru returns a single post as an object instead of array sometimes
    const posts = Array.isArray(data.post) ? data.post : [data.post];
    
    // Filter out any null/undefined posts and convert
    return posts
      .filter(post => post != null)
      .map(post => this.convertGelbooruToUnified(post));
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

      const apiKeyParam = this.apiKey ? this.apiKey : '';
      const url = `/api/proxy?url=${encodeURIComponent(`${this.baseUrl}/index.php?${queryParams}${apiKeyParam}`)}`;
      const response = await this.fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch post: ${response.statusText}`);
      }

      const data: GelbooruResponse = await response.json();
      if (!data.post || data.post.length === 0) {
        throw new Error('Post not found');
      }

      const post = Array.isArray(data.post) ? data.post[0] : data.post;
      return this.convertGelbooruToUnified(post);
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

      const apiKeyParam = this.apiKey ? this.apiKey : '';
      const url = `/api/proxy?url=${encodeURIComponent(`${this.baseUrl}/index.php?${queryParams}${apiKeyParam}`)}`;
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
  constructor(site: Site = 'yande.re') {
    super(site);
  }
}