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

export type Site = 'yande.re' | 'konachan.com';

export class MoebooruAPI {
  private baseUrl: string;
  private timeout = 30000; // 30 seconds timeout

  constructor(site: Site = 'yande.re') {
    this.baseUrl = `https://${site}`;
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

  async getPosts(params: {
    page?: number;
    limit?: number;
    tags?: string;
    rating?: 's' | 'q' | 'e';
  } = {}): Promise<MoebooruPost[]> {
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

    return response.json();
  }

  async getPost(id: number): Promise<MoebooruPost> {
    const url = `/api/proxy?url=${encodeURIComponent(`${this.baseUrl}/post/show/${id}.json`)}`;
    const response = await this.fetchWithTimeout(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch post: ${response.statusText}`);
    }

    return response.json();
  }

  async searchTags(query: string): Promise<unknown[]> {
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