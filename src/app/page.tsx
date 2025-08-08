'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ImageBoardAPI, UnifiedPost, Site } from '@/lib/api';
import ImageCard from '@/components/ImageCard';
import ImageViewer from '@/components/ImageViewer';
import SearchBar from '@/components/SearchBar';
import { toast } from 'sonner';

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
  const [tagPromptSite, setTagPromptSite] = useState<Site | null>(null);
  
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

  // On first app start (default provider selected), ask to download tags for the default site
  useEffect(() => {
    maybePromptOrAutoPrefetch(site);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage !== page && !loadingRef.current) {
      setPage(newPage);
      setPosts([]);
      loadPosts(newPage, true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page, loadPosts]);

  // Start tags prefetch for supported sites with a toast
  const prefetchingSitesRef = useRef<Set<Site>>(new Set());
  const toastIdsRef = useRef<Map<Site, string | number>>(new Map());

  const startTagPrefetch = useCallback(async (targetSite: Site) => {
    if (targetSite !== 'yande.re' && targetSite !== 'konachan.com' && targetSite !== 'rule34.xxx' && targetSite !== 'e621.net') return;

    // prevent parallel duplicate prefetches and duplicate toasts per site
    if (prefetchingSitesRef.current.has(targetSite)) return;
    prefetchingSitesRef.current.add(targetSite);

    try {
      // Check current status first
      const statusRes = await fetch(`/api/tags/status?site=${encodeURIComponent(targetSite)}`);
      const status = await statusRes.json();

      // If already fresh and has cache, no need to show long toast
      if (status && status.fresh && status.hasCache && status.size > 0) {
        toast.success(`${targetSite} tags are up to date (${status.size.toLocaleString()} tags)`);
        return;
      }

      // Create or reuse an indeterminate progress toast with libadwaita-like card styling
      let id = toastIdsRef.current.get(targetSite);
      if (id === undefined) {
        id = toast.custom(() => (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: 14,
            minWidth: 300,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--accent)' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Preparing tags</div>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Downloading tags for {targetSite}…</div>
            <div style={{ width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 9999, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: '40%', height: '100%', background: 'var(--accent)', animation: 'indeterminate 1.2s ease-in-out infinite', borderRadius: 9999 }} />
            </div>
            <style jsx>{`
              @keyframes indeterminate {
                0% { transform: translateX(-100%); }
                50% { transform: translateX(50%); }
                100% { transform: translateX(200%); }
              }
            `}</style>
          </div>
        ), { duration: Infinity });
        toastIdsRef.current.set(targetSite, id);
      }

      // Kick off background refresh only if not already in progress
      if (!status?.inProgress) {
        await fetch('/api/tags/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site: targetSite })
        });
      }

      // Poll for completion
      const started = Date.now();
      let done = false;
      while (!done && Date.now() - started < 5 * 60_000) { // up to 5 minutes
        await new Promise(r => setTimeout(r, 2000));
        const res = await fetch(`/api/tags/status?site=${encodeURIComponent(targetSite)}`);
        const st = await res.json();
        if (st && st.fresh && st.hasCache && st.size > 0 && !st.inProgress) {
          done = true;
          if (id !== undefined) toast.dismiss(id);
          toastIdsRef.current.delete(targetSite);
          toast.success(`Downloaded ${st.size.toLocaleString()} ${targetSite} tags`);
          break;
        }
      }

      if (!done) {
        if (id !== undefined) toast.dismiss(id);
        toastIdsRef.current.delete(targetSite);
        toast.message(`Tag download for ${targetSite} is still running in background`);
      }
    } catch (e) {
      console.error('Prefetch failed', e);
      toast.error('Failed to prefetch tags');
    } finally {
      prefetchingSitesRef.current.delete(targetSite);
    }
  }, []);

  const getDownloadSizeLabel = useCallback((targetSite: Site) => {
    if (targetSite === 'rule34.xxx') return 'about 100 MB';
    if (targetSite === 'yande.re' || targetSite === 'konachan.com') return 'about 10 MB';
    if (targetSite === 'e621.net') return 'about 15 MB';
    return '';
  }, []);

  const getConsent = (targetSite: Site): 'accepted' | 'declined' | null => {
    if (typeof window === 'undefined') return null;
    return (localStorage.getItem(`tag_prefetch_consent_${targetSite}`) as any) || null;
  };

  const setConsent = (targetSite: Site, value: 'accepted' | 'declined') => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`tag_prefetch_consent_${targetSite}`, value);
  };

  const maybePromptOrAutoPrefetch = useCallback((targetSite: Site) => {
    if (targetSite !== 'yande.re' && targetSite !== 'konachan.com' && targetSite !== 'rule34.xxx' && targetSite !== 'e621.net') return;
    const c = getConsent(targetSite);
    if (c === 'accepted') {
      startTagPrefetch(targetSite);
      return;
    }
    if (c === null) {
      setTagPromptSite(targetSite);
    }
  }, [startTagPrefetch]);

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
    // On first switch to supported sites, ask consent to download tags
    setSite(newSite);
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setError(null);

    // Prompt or auto-prefetch based on prior consent
    maybePromptOrAutoPrefetch(newSite);
    
    // Update search tags with the new site's default rating if current search is empty or only a rating
    const currentTags = searchTags.trim();
    const isOnlyRating = currentTags === 'rating:safe' || 
                         currentTags === 'rating:general' || 
                         currentTags === '';
    
    if (isOnlyRating) {
      const defaultRating = newSite === 'gelbooru.com' ? 'rating:general' : newSite === 'rule34.xxx' ? '' : newSite === 'e621.net' ? 'rating:safe' : 'rating:safe';
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
          onDownloadTags={(s) => { setConsent(s, 'accepted'); startTagPrefetch(s); }}
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
         apiKey={apiKey}
         onClose={() => setSelectedPost(null)}
         onTagClick={(tag) => {
           setSearchTags(tag);
           setPosts([]);
           setPage(1);
           setHasMore(true);
         }}
       />

       {tagPromptSite && typeof document !== 'undefined' && ReactDOM.createPortal(
         <div className="modal-overlay" onClick={() => setTagPromptSite(null)}>
           <div className="modal-content" onClick={(e) => e.stopPropagation()}>
             <h3>Download tags for {tagPromptSite}?</h3>
             <p className="modal-description">
               To enable fast, offline tag autocomplete and colored tag info, we can download the full tag list for {tagPromptSite}. The average download size is {getDownloadSizeLabel(tagPromptSite)}.
             </p>
             <div className="modal-buttons">
               <button
                 className="modal-button save"
                 onClick={() => {
                   const s = tagPromptSite as Site;
                   setConsent(s, 'accepted');
                   setTagPromptSite(null);
                   startTagPrefetch(s);
                 }}
               >
                 Download tags
               </button>
               <button
                 className="modal-button cancel"
                 onClick={() => {
                   const s = tagPromptSite as Site;
                   setConsent(s, 'declined');
                   setTagPromptSite(null);
                 }}
               >
                 Not now
               </button>
             </div>
           </div>
         </div>,
         document.body
       )}
 
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

        /* Modal styles (shared look with other modals) */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 24px;
          max-width: 520px;
          width: 90%;
        }
        .modal-content h3 {
          margin: 0 0 12px 0;
          color: var(--text-primary);
          font-size: 18px;
        }
        .modal-description {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 16px;
        }
        .modal-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .modal-button {
          padding: 8px 16px;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .modal-button.save {
          background: var(--accent);
          color: white;
        }
        .modal-button.save:hover {
          background: var(--accent-hover);
        }
        .modal-button.cancel {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }
        .modal-button.cancel:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
