'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MoebooruAPI, MoebooruPost, Site } from '@/lib/api';
import ImageCard from '@/components/ImageCard';
import ImageViewer from '@/components/ImageViewer';
import SearchBar from '@/components/SearchBar';

export default function Home() {
  const [posts, setPosts] = useState<MoebooruPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<MoebooruPost | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchTags, setSearchTags] = useState('');
  const [site, setSite] = useState<Site>('yande.re');
  const [rating, setRating] = useState<'s' | 'q' | 'e' | null>(null);
  
  const apiRef = useRef<MoebooruAPI>(new MoebooruAPI(site));
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const loadPosts = useCallback(async (pageNum: number, reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const newPosts = await apiRef.current.getPosts({
        page: pageNum,
        limit: 30,
        tags: searchTags,
        rating: rating || undefined,
      });

      if (newPosts.length === 0) {
        setHasMore(false);
      } else {
        setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [searchTags, rating, loading]);

  useEffect(() => {
    apiRef.current = new MoebooruAPI(site);
    setPosts([]);
    setPage(1);
    setHasMore(true);
    loadPosts(1, true);
  }, [site, searchTags, rating, loadPosts]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadPosts(nextPage);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [page, hasMore, loading, loadPosts]);

  const handleSearch = (tags: string) => {
    setSearchTags(tags);
    setPosts([]);
    setPage(1);
    setHasMore(true);
  };

  const handleSiteChange = (newSite: Site) => {
    setSite(newSite);
    setPosts([]);
    setPage(1);
    setHasMore(true);
  };

  const handleRatingChange = (newRating: 's' | 'q' | 'e' | null) => {
    setRating(newRating);
    setPosts([]);
    setPage(1);
    setHasMore(true);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">Moebooru Viewer</h1>
          <p className="app-subtitle">Browse images from {site}</p>
        </div>
        
        <SearchBar
          onSearch={handleSearch}
          onSiteChange={handleSiteChange}
          onRatingChange={handleRatingChange}
          currentSite={site}
          currentRating={rating}
        />
      </header>

      <main className="app-main">
        {error && (
          <div className="error-message">
            <p>Error: {error}</p>
          </div>
        )}

        <div className="gallery-grid">
          {posts.map((post) => (
            <ImageCard
              key={post.id}
              post={post}
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

        {hasMore && !loading && (
          <div ref={loadMoreRef} className="load-more-trigger" />
        )}

        {!hasMore && posts.length > 0 && (
          <div className="end-message">
            <p>No more images to load</p>
          </div>
        )}

        {!loading && posts.length === 0 && !error && (
          <div className="empty-message">
            <p>No images found</p>
          </div>
        )}
      </main>

      <ImageViewer
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
      />

      <style jsx>{`
        .app-container {
          min-height: 100vh;
          background: var(--bg-primary);
        }

        .app-header {
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
          padding: 32px 24px;
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(10px);
          background: rgba(36, 36, 36, 0.95);
        }

        .header-content {
          text-align: center;
          margin-bottom: 24px;
        }

        .app-title {
          font-size: 28px;
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

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 16px;
          margin-bottom: 48px;
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

        .error-message,
        .empty-message,
        .end-message {
          text-align: center;
          padding: 48px;
          color: var(--text-secondary);
        }

        .error-message {
          color: #ff6b6b;
        }

        .load-more-trigger {
          height: 100px;
        }

        @media (max-width: 768px) {
          .app-header {
            padding: 24px 16px;
          }

          .app-main {
            padding: 16px;
          }

          .gallery-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}