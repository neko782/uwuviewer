'use client';

import { UnifiedPost, Site } from '@/lib/api';
import { proxyImageUrl } from '@/lib/imageProxy';
import { getRatingLabel } from '@/lib/constants';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface ImageViewerProps {
  post: UnifiedPost | null;
  site: Site;
  apiKey?: string;
  onClose: () => void;
  onTagClick?: (tag: string) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

interface TagInfo {
  count: number;
  type: number;
  color: string;
}

interface TagData {
  tags: Record<string, TagInfo | null>;
  grouped: Record<string, string[]>;
}

export default function ImageViewer({ 
  post, 
  site, 
  apiKey, 
  onClose, 
  onTagClick,
  onNavigate,
  hasPrevious = false,
  hasNext = false
}: ImageViewerProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [tagData, setTagData] = useState<TagData>({ tags: {}, grouped: {} });
  const [isZoomed, setIsZoomed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation handlers
  const handlePrevious = useCallback(() => {
    if (onNavigate && hasPrevious) {
      onNavigate('prev');
    }
  }, [onNavigate, hasPrevious]);

  const handleNext = useCallback(() => {
    if (onNavigate && hasNext) {
      onNavigate('next');
    }
  }, [onNavigate, hasNext]);

  const handleToggleZoom = useCallback(() => {
    setIsZoomed(prev => !prev);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      viewerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (post?.file_url) {
      const link = document.createElement('a');
      link.href = proxyImageUrl(post.file_url);
      link.download = `${post.id}.${extFromUrl(post.file_url) || 'jpg'}`;
      // Remove target='_blank' to trigger download instead of opening new tab
      link.click();
    }
  }, [post]);

  const handleCopyUrl = useCallback(() => {
    if (post?.file_url) {
      navigator.clipboard.writeText(post.file_url);
      // You could show a toast here if you have a toast system
    }
  }, [post]);


  const handleScrollInfo = useCallback((direction: 'up' | 'down') => {
    if (infoRef.current) {
      const scrollAmount = 100;
      infoRef.current.scrollBy({
        top: direction === 'down' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      });
    }
  }, []);

  // Setup keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'Escape', handler: onClose, description: 'Close viewer' },
    { key: 'ArrowLeft', handler: handlePrevious, enabled: hasPrevious, description: 'Previous image' },
    { key: 'ArrowRight', handler: handleNext, enabled: hasNext, description: 'Next image' },
    { key: 'ArrowUp', handler: () => handleScrollInfo('up'), description: 'Scroll info up' },
    { key: 'ArrowDown', handler: () => handleScrollInfo('down'), description: 'Scroll info down' },
    { key: ' ', handler: handleToggleZoom, description: 'Toggle zoom' },
    { key: 'f', handler: handleToggleFullscreen, description: 'Toggle fullscreen' },
    { key: 'd', handler: handleDownload, description: 'Download image' },
    { key: 'c', handler: handleCopyUrl, description: 'Copy image URL' },
  ], { enabled: !!post });

  // Reset imageLoaded state when post changes
  useEffect(() => {
    setImageLoaded(false);
  }, [post?.id]);

  useEffect(() => {
    if (post) {
      document.body.style.overflow = 'hidden';
      
      // Fetch tag info for yande.re, konachan.com, gelbooru.com, rule34.xxx, and e621.net
      if ((site === 'yande.re' || site === 'konachan.com' || site === 'gelbooru.com' || site === 'rule34.xxx' || site === 'e621.net') && post.tags) {
        const tags = post.tags.split(' ').filter(tag => tag.length > 0);
        
        fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags, site, apiKey })
        })
          .then(res => res.json())
          .then(data => setTagData(data))
          .catch(err => console.error('Failed to fetch tag info:', err));
      }
    }

    return () => {
      document.body.style.overflow = '';
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    };
  }, [post, site, apiKey]);

  if (!post) return null;

  const getPostUrl = () => {
    if (site === 'gelbooru.com') {
      return `https://gelbooru.com/index.php?page=post&s=view&id=${post.id}`;
    } else if (site === 'rule34.xxx') {
      return `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`;
    } else if (site === 'e621.net') {
      return `https://e621.net/posts/${post.id}`;
    } else {
      return `https://${site}/post/show/${post.id}`;
    }
  };

  const isVideo = (() => {
    const url = post.file_url || '';
    if (!url) return false;
    try {
      const u = new URL(url);
      const pathname = u.pathname.toLowerCase();
      return pathname.endsWith('.webm') || pathname.endsWith('.mp4') || pathname.endsWith('.m4v') || pathname.endsWith('.mov') || pathname.endsWith('.mkv') || pathname.endsWith('.avi');
    } catch {
      const lower = url.toLowerCase();
      return lower.includes('.webm') || lower.includes('.mp4') || lower.includes('.m4v') || lower.includes('.mov') || lower.includes('.mkv') || lower.includes('.avi');
    }
  })();

  const displayUrl = isVideo ? post.file_url : (post.sample_url || post.file_url);
  const hasImage = !!displayUrl;

  const formatBytes = (n?: number): string => {
    if (!n || n <= 0) return 'Unknown';
    const units = ['B','KB','MB','GB','TB'];
    let idx = 0; let val = n;
    while (val >= 1024 && idx < units.length - 1) { val /= 1024; idx++; }
    return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${units[idx]}`;
  };

  const extFromUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    try {
      const u = new URL(url);
      const p = u.pathname.toLowerCase();
      const m = p.match(/\.([a-z0-9]+)$/);
      return m ? m[1] : undefined;
    } catch {
      const m = (url || '').toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
      return m ? m[1] : undefined;
    }
  };

  const fileExt = (post as any).file_ext || extFromUrl(post.file_url) || extFromUrl(post.sample_url);

  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const ratio = (() => {
    const w = post.width | 0; const h = post.height | 0;
    if (!w || !h) return '';
    const g = gcd(w, h);
    return `${Math.round(w / g)}:${Math.round(h / g)}`;
  })();
  const megapixels = (post.width && post.height) ? (post.width * post.height / 1_000_000) : 0;

  const createdAtText = (() => {
    const v: any = (post as any).created_at;
    if (!v) return '';
    try {
      const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString();
    } catch { return ''; }
  })();

  const uploaderName = (post as any).author as string | undefined;
  const favCount: number | undefined = (post as any).fav_count;

  return (
    <div className="viewer-overlay" onClick={onClose} ref={viewerRef}>
      <div className="viewer-container" onClick={(e) => e.stopPropagation()}>
        <button className="viewer-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="viewer-content">
          {!hasImage && (
            <div className="viewer-loading" style={{ color: 'var(--text-secondary)' }}>
              no image available
            </div>
          )}

          {hasImage && !imageLoaded && (
            <div className="viewer-loading">
              <div className="spinner" />
              <div className="loading-text">Loading image...</div>
            </div>
          )}
          
          {hasImage && (
            isVideo ? (
              <video
                src={proxyImageUrl(displayUrl)}
                className={`viewer-media ${imageLoaded ? 'loaded' : ''}`}
                controls
                loop
                playsInline
                onLoadedData={() => setImageLoaded(true)}
              />
            ) : (
              <img
                ref={mediaRef as React.RefObject<HTMLImageElement>}
                src={proxyImageUrl(displayUrl)}
                alt={`Post ${post.id}`}
                className={`viewer-media ${imageLoaded ? 'loaded' : ''} ${isZoomed ? 'zoomed' : ''}`}
                onLoad={() => setImageLoaded(true)}
                onClick={handleToggleZoom}
                style={isZoomed ? { cursor: 'zoom-out' } : { cursor: 'zoom-in' }}
              />
            )
          )}
        </div>

        {/* Navigation arrows */}
        {onNavigate && hasPrevious && (
          <button 
            className="viewer-nav viewer-nav-prev" 
            onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
            title="Previous (←)"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        
        {onNavigate && hasNext && (
          <button 
            className="viewer-nav viewer-nav-next" 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            title="Next (→)"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        <div className="viewer-info" ref={infoRef}>

          <div className="info-section">
            <h3>Tags</h3>
            {(site === 'yande.re' || site === 'konachan.com' || site === 'gelbooru.com' || site === 'rule34.xxx' || site === 'e621.net') && Object.keys(tagData.grouped).length > 0 ? (
              <div className="tags-grouped">
                {Object.entries(tagData.grouped)
                  .sort(([aName], [bName]) => {
                    const order = ['artist','character','species','copyright','circle','general','lore','style','metadata','meta','faults','deprecated','invalid','unknown'];
                    const idx = (name: string) => {
                      const n = name.toLowerCase();
                      const key = (n === 'metadata' || n === 'meta') ? 'metadata' : n;
                      const i = order.indexOf(key);
                      return i === -1 ? order.length + 1 : i;
                    };
                    const ai = idx(aName);
                    const bi = idx(bName);
                    if (ai !== bi) return ai - bi;
                    return aName.localeCompare(bName);
                  })
                  .map(([groupName, tags]) => (
                  <div key={groupName} className="tag-group">
                    <h4 className="tag-group-title">{groupName}</h4>
                    <div className="tags-container">
                      {tags.map((tag, index) => {
                        const info = tagData.tags[tag];
                        return (
                          <button
                            key={index}
                            className="tag"
                            style={info ? {
                              backgroundColor: info.color,
                              color: '#fff',
                              border: 'none'
                            } : {}}
                            onClick={() => {
                              if (onTagClick) {
                                onTagClick(tag);
                                onClose();
                              }
                            }}
                            title={info ? `${tag} (${info.count} posts)` : tag}
                          >
                            {tag.replace(/_/g, ' ')}
                            {info && <span className="tag-count">({info.count})</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tags-container">
                {post.tags.split(' ').filter(tag => tag.length > 0).map((tag, index) => {
                  const info = (site === 'yande.re' || site === 'konachan.com' || site === 'gelbooru.com' || site === 'rule34.xxx' || site === 'e621.net') ? tagData.tags[tag] : null;
                  return (
                    <button
                      key={index}
                      className="tag"
                      style={info ? {
                        backgroundColor: info.color,
                        color: '#fff',
                        border: 'none'
                      } : {}}
                      onClick={() => {
                        if (onTagClick) {
                          onTagClick(tag);
                          onClose();
                        }
                      }}
                      title={info ? `${tag} (${info.count} posts)` : tag}
                    >
                      {tag.replace(/_/g, ' ')}
                      {info && <span className="tag-count">({info.count})</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="info-actions">
            <a
              href={post.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="action-button"
              title="View original image file"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              View Original
            </a>
            
            <a
              href={getPostUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="action-button primary"
              title="View on original site"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              View Post
            </a>
          </div>

          <div className="info-section info-details">
            <h3>Information</h3>
            <div className="info-grid">
              <span className="info-label">Site</span>
              <span className="info-value">{site}</span>

              <span className="info-label">Post ID</span>
              <span className="info-value"><a href={getPostUrl()} target="_blank" rel="noopener noreferrer">{post.id}</a></span>

              <span className="info-label">Size</span>
              <span className="info-value">{post.width} × {post.height}{megapixels ? ` (${megapixels.toFixed(2)} MP)` : ''}</span>

              {ratio && (<>
                <span className="info-label">Aspect</span>
                <span className="info-value">{ratio}</span>
              </>)}

              <span className="info-label">Rating</span>
              <span className="info-value">{getRatingLabel(site, post.rating)}</span>

              <span className="info-label">Score</span>
              <span className="info-value">{post.score}</span>

              {typeof favCount === 'number' && (
                <>
                  <span className="info-label">Favorites</span>
                  <span className="info-value">{favCount}</span>
                </>
              )}

              <span className="info-label">Has Children</span>
              <span className="info-value">{post.has_children ? 'Yes' : 'No'}</span>

              {createdAtText && (
                <>
                  <span className="info-label">Created</span>
                  <span className="info-value">{createdAtText}</span>
                </>
              )}

              {uploaderName && (
                <>
                  <span className="info-label">Uploader</span>
                  <span className="info-value">{uploaderName}</span>
                </>
              )}

              <span className="info-label">File Type</span>
              <span className="info-value">{fileExt ? fileExt.toUpperCase() : 'Unknown'}</span>

              <span className="info-label">File Size</span>
              <span className="info-value">{formatBytes((post as any).file_size)}</span>

              <span className="info-label">MD5</span>
              <span className="info-value">{(post as any).md5 || 'Unknown'}</span>

              <span className="info-label">Source</span>
              <span className="info-value">
                {post.source ? (
                  <a href={post.source} target="_blank" rel="noopener noreferrer">
                    View source
                  </a>
                ) : 'None'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .viewer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .viewer-container {
          background: var(--bg-secondary);
          border-radius: var(--radius-lg);
          width: 90vw;
          height: 85vh;
          display: flex;
          overflow: hidden;
          position: relative;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .viewer-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background: var(--bg-tertiary);
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: background 0.2s ease;
        }

        .viewer-close:hover {
          background: var(--bg-hover);
        }

        .viewer-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          position: relative;
          overflow: hidden;
        }

        .viewer-loading {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 5;
          animation: fadeIn 0.2s ease;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-text {
          margin-top: 16px;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        .viewer-media {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          opacity: 0;
          transition: opacity 0.4s ease, transform 0.4s ease;
          display: block;
          background: black;
          transform: scale(0.95);
        }

        .viewer-media.loaded {
          opacity: 1;
          transform: scale(1);
        }
        
        .viewer-media.zoomed {
          max-width: none;
          max-height: none;
          cursor: zoom-out !important;
        }

        .viewer-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 48px;
          border-radius: var(--radius-sm);
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: all 0.2s ease;
          opacity: 0.7;
        }

        .viewer-nav:hover {
          opacity: 1;
          background: rgba(0, 0, 0, 0.9);
          transform: translateY(-50%) scale(1.1);
        }

        .viewer-nav-prev {
          left: 20px;
        }

        .viewer-nav-next {
          right: 380px;
        }

        @media (max-width: 768px) {
          .viewer-nav-next {
            right: 20px;
          }
        }

        .viewer-info {
          width: 360px;
          padding: 24px;
          overflow-y: auto;
          background: var(--bg-secondary);
          border-left: 1px solid var(--border-subtle);
          flex-shrink: 0;
        }

        .info-section {
          margin-bottom: 24px;
        }
        .info-details {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid var(--border-subtle);
        }

        .info-section h3 {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 8px 16px;
          font-size: 14px;
        }

        .info-label {
          color: var(--text-secondary);
        }

        .info-value {
          color: var(--text-primary);
        }

        .info-value a {
          color: var(--accent);
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .info-value a:hover {
          color: var(--accent-hover);
        }

        .tags-grouped {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .tag-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tag-group-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0;
        }

        .tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tag {
          padding: 4px 10px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          font-size: 12px;
          color: var(--text-secondary);
          transition: all 0.2s ease;
          border: 1px solid transparent;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .tag:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .tag-count {
          font-size: 10px;
          opacity: 0.9;
          font-weight: 500;
        }

        .info-actions {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          gap: 8px;
        }

        .action-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-radius: var(--radius-sm);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          border: 1px solid var(--border-subtle);
          flex: 1;
        }

        .action-button:hover {
          background: var(--bg-hover);
          border-color: var(--accent);
        }

        .action-button.primary {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        .action-button.primary:hover {
          background: var(--accent-hover);
          border-color: var(--accent-hover);
        }

        .action-button svg {
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .viewer-container {
            flex-direction: column;
            width: 95vw;
            height: 90vh;
          }

          .viewer-content {
            flex: 1;
            min-height: 0;
          }

          .viewer-info {
            width: 100%;
            border-left: none;
            border-top: 1px solid var(--border-subtle);
            height: 40%;
            flex-shrink: 0;
          }
        }
      `}</style>
    </div>
  );
}