'use client';

import { UnifiedPost, Site } from '@/lib/api';
import { proxyImageUrl } from '@/lib/imageProxy';
import { useEffect, useState } from 'react';

interface ImageViewerProps {
  post: UnifiedPost | null;
  site: Site;
  apiKey?: string;
  onClose: () => void;
  onTagClick?: (tag: string) => void;
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

export default function ImageViewer({ post, site, apiKey, onClose, onTagClick }: ImageViewerProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [tagData, setTagData] = useState<TagData>({ tags: {}, grouped: {} });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (post) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      // Fetch tag info for yande.re, konachan.com, and gelbooru.com
      if ((site === 'yande.re' || site === 'konachan.com' || site === 'gelbooru.com') && post.tags) {
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
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [post, onClose, site, apiKey]);

  if (!post) return null;

  const getPostUrl = () => {
    if (site === 'gelbooru.com') {
      return `https://gelbooru.com/index.php?page=post&s=view&id=${post.id}`;
    } else {
      return `https://${site}/post/show/${post.id}`;
    }
  };

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-container" onClick={(e) => e.stopPropagation()}>
        <button className="viewer-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="viewer-content">
          {!imageLoaded && (
            <div className="viewer-loading">
              <div className="spinner" />
            </div>
          )}
          
          <img
            src={proxyImageUrl(post.sample_url || post.file_url)}
            alt={`Post ${post.id}`}
            className={`viewer-image ${imageLoaded ? 'loaded' : ''}`}
            onLoad={() => setImageLoaded(true)}
          />
        </div>

        <div className="viewer-info">
          <div className="info-section">
            <h3>Information</h3>
            <div className="info-grid">
              <span className="info-label">Size</span>
              <span className="info-value">{post.width} × {post.height}</span>
              
              <span className="info-label">Rating</span>
              <span className="info-value">{
                site === 'gelbooru.com' ? (
                  post.rating === 's' ? 'General' :
                  post.rating === 'sensitive' ? 'Sensitive' :
                  post.rating === 'q' ? 'Questionable' : 'Explicit'
                ) : (
                  post.rating === 's' ? 'Safe' :
                  post.rating === 'q' ? 'Questionable' : 'Explicit'
                )
              }</span>
              
              <span className="info-label">Score</span>
              <span className="info-value">{post.score}</span>
              
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

          <div className="info-section">
            <h3>Tags</h3>
            {(site === 'yande.re' || site === 'konachan.com' || site === 'gelbooru.com') && Object.keys(tagData.grouped).length > 0 ? (
              <div className="tags-grouped">
                {Object.entries(tagData.grouped).map(([groupName, tags]) => (
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
                  const info = (site === 'yande.re' || site === 'konachan.com' || site === 'gelbooru.com') ? tagData.tags[tag] : null;
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
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--bg-tertiary);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .viewer-image {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          opacity: 0;
          transition: opacity 0.3s ease;
          display: block;
        }

        .viewer-image.loaded {
          opacity: 1;
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