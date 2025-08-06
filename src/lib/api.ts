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

  constructor(site: Site = 'yande.re') {
    this.baseUrl = `https://${site}`;
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

    const response = await fetch(`${this.baseUrl}/post.json?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }

    return response.json();
  }

  async getPost(id: number): Promise<MoebooruPost> {
    const response = await fetch(`${this.baseUrl}/post/show/${id}.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch post: ${response.statusText}`);
    }

    return response.json();
  }

  async searchTags(query: string): Promise<unknown[]> {
    const response = await fetch(
      `${this.baseUrl}/tag.json?name=${encodeURIComponent(query)}*&limit=10`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to search tags: ${response.statusText}`);
    }

    return response.json();
  }
}