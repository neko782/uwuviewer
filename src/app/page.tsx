'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ImageBoardAPI, UnifiedPost, Site } from '@/lib/api';
import ImageCard from '@/components/ImageCard';
import ImageViewer from '@/components/ImageViewer';
import SearchBar from '@/components/SearchBar';

export default function Home() {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<UnifiedPost | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [site, setSite] = useState<Site>('yande.re');
  const [searchTags, setSearchTags] = useState('rating:safe'); // Initialize with default rating for yande.re
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [imageType, setImageType] = useState<'preview' | 'sample'>('preview');
  const [apiKey, setApiKey] = useState(() => {
    // Load API key from localStorage on initial load
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gelbooru_api_key') || '';
    }
    return '';
  });
  
  const apiRef = useRef<ImageBoardAPI>(new ImageBoardAPI(site, apiKey));
  const loadingRef = useRef(false);

  const loadPosts = useCallback(async (pageNum: number, reset = false, tags?: string) => {
    if (loadingRef.current && !reset) return;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const newPosts = await apiRef.current.getPosts({
        page: pageNum,
        limit: 30,
        tags: tags || searchTags,
      });

      if (newPosts.length === 0) {
        setHasMore(false);
        if (reset) {
          setPosts([]);
        }
      } else {
        setPosts(prevPosts => reset ? newPosts : [...prevPosts, ...newPosts]);
        setHasMore(newPosts.length === 30);
      }
      setIsInitialLoad(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
      setHasMore(false);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [searchTags]);

  useEffect(() => {
    apiRef.current = new ImageBoardAPI(site, apiKey);
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setIsInitialLoad(true);
    loadPosts(1, true, searchTags);
  }, [site, searchTags, apiKey, loadPosts]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage !== page && !loadingRef.current) {
      setPage(newPage);
      setPosts([]);
      loadPosts(newPage, true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page, loadPosts]);

  const handleSearch = (tags: string) => {
    // Only reset if the tags have actually changed
    if (tags !== searchTags) {
      setSearchTags(tags);
      setPosts([]);
      setPage(1);
      setHasMore(true);
      setError(null);
    }
  };

  const handleSiteChange = (newSite: Site) => {
    setSite(newSite);
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    
    // Update search tags with the new site's default rating if current search is empty or only a rating
    const currentTags = searchTags.trim();
    const isOnlyRating = currentTags === 'rating:safe' || 
                         currentTags === 'rating:general' || 
                         currentTags === '';
    
    if (isOnlyRating) {
      const defaultRating = newSite === 'gelbooru.com' ? 'rating:general' : 'rating:safe';
      setSearchTags(defaultRating);
    }
  };



  const handleImageTypeChange = (newImageType: 'preview' | 'sample') => {
    setImageType(newImageType);
  };

  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
    // Save API key to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('gelbooru_api_key', newApiKey);
    }
  };

  const handleRetry = () => {
    setError(null);
    setHasMore(true);
    if (posts.length === 0) {
      loadPosts(1, true);
    } else {
      loadPosts(page);
    }
  };

  return (
    <div className="app-container">
      <button 
        className={`header-toggle ${headerHidden ? 'floating' : ''}`}
        onClick={() => setHeaderHidden(!headerHidden)}
        aria-label={headerHidden ? 'Show header' : 'Hide header'}
      >
        {headerHidden ? '☰' : '✕'}
      </button>
      
      <header className={`app-header ${headerHidden ? 'hidden' : ''}`}>
        <div className="header-content">
          <h1 className="app-title">uwuviewer</h1>
        </div>
        
        <SearchBar
          onSearch={handleSearch}
          onSiteChange={handleSiteChange}
          onPageChange={handlePageChange}
          onImageTypeChange={handleImageTypeChange}
          onApiKeyChange={handleApiKeyChange}
          currentSite={site}
          currentPage={page}
          currentImageType={imageType}
          currentApiKey={apiKey}
          hasMore={hasMore}
          loading={loading}
          searchTags={searchTags}
        />
      </header>

      <main className="app-main">
        {error && (
          <div className="error-container">
            <div className="error-message">
              <p>Error: {error}</p>
              <button onClick={handleRetry} className="retry-button">
                Try Again
              </button>
            </div>
          </div>
        )}

        <div className="gallery-masonry">
          {posts.map((post) => (
            <ImageCard
              key={post.id}
              post={post}
              site={site}
              imageType={imageType}
              onClick={() => setSelectedPost(post)}
            />
          ))}
        </div>

        {loading && (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading images...</p>
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="end-message">
            <p>No more images to load</p>
          </div>
        )}

        {!loading && posts.length === 0 && !error && !isInitialLoad && (
          <div className="empty-message">
            <p>No images found</p>
          </div>
        )}
      </main>

      <ImageViewer
        post={selectedPost}
        site={site}
        onClose={() => setSelectedPost(null)}
        onTagClick={(tag) => {
          setSearchTags(tag);
          setPosts([]);
          setPage(1);
          setHasMore(true);
          setError(null);
        }}
      />

      <style jsx>{`
        .app-container {
          min-height: 100vh;
          background: var(--bg-primary);
        }

        .header-toggle {
          position: fixed;
          top: 16px;
          left: 16px;
          z-index: 101;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .header-toggle:hover {
          background: var(--bg-tertiary);
          transform: scale(1.05);
        }

        .header-toggle.floating {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .header-toggle.floating:hover {
          background: var(--accent-hover);
        }

        .app-header {
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
          padding: 24px 24px;
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(10px);
          background: rgba(36, 36, 36, 0.95);
          transition: transform 0.3s ease, opacity 0.3s ease;
        }

        .app-header.hidden {
          transform: translateY(-100%);
          opacity: 0;
          pointer-events: none;
        }

        .header-content {
          text-align: center;
          margin-bottom: 16px;
        }

        .app-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
          letter-spacing: -0.5px;
        }

        .app-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .app-main {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .gallery-masonry {
          column-count: 5;
          column-gap: 16px;
          margin-bottom: 48px;
        }
        
        @media (max-width: 1400px) {
          .gallery-masonry {
            column-count: 4;
          }
        }
        
        @media (max-width: 1024px) {
          .gallery-masonry {
            column-count: 3;
          }
        }
        
        @media (max-width: 768px) {
          .gallery-masonry {
            column-count: 2;
            column-gap: 12px;
          }
        }
        
        @media (max-width: 480px) {
          .gallery-masonry {
            column-count: 1;
          }
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          color: var(--text-secondary);
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid var(--bg-tertiary);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-container {
          display: flex;
          justify-content: center;
          padding: 48px;
        }

        .error-message {
          text-align: center;
          color: #ff6b6b;
        }

        .error-message p {
          margin-bottom: 16px;
        }

        .retry-button {
          padding: 10px 24px;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .retry-button:hover {
          background: var(--accent-hover);
        }

        .empty-message,
        .end-message {
          text-align: center;
          padding: 48px;
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .app-header {
            padding: 24px 16px;
          }

          .app-main {
            padding: 16px;
          }


        }
      `}</style>
    </div>
  );
}