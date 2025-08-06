'use client';

import { MoebooruPost } from '@/lib/api';
import { useEffect, useState } from 'react';

interface ImageViewerProps {
  post: MoebooruPost | null;
  onClose: () => void;
}

export default function ImageViewer({ post, onClose }: ImageViewerProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (post) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [post, onClose]);

  if (!post) return null;

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
            src={post.sample_url || post.file_url}
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
                post.rating === 's' ? 'Safe' :
                post.rating === 'q' ? 'Questionable' : 'Explicit'
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
            <div className="tags-container">
              {post.tags.split(' ').slice(0, 20).map((tag, index) => (
                <span key={index} className="tag">
                  {tag.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          <div className="info-actions">
            <a
              href={post.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="action-button"
            >
              View Original
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
          z-index: 1000;
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
          max-width: 90vw;
          max-height: 90vh;
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
          min-height: 400px;
          max-height: 90vh;
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
          max-height: 90vh;
          object-fit: contain;
          opacity: 0;
          transition: opacity 0.3s ease;
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
          transition: background 0.2s ease, color 0.2s ease;
        }

        .tag:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .info-actions {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid var(--border-subtle);
        }

        .action-button {
          display: inline-block;
          padding: 10px 20px;
          background: var(--accent);
          color: white;
          border-radius: var(--radius-sm);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s ease;
        }

        .action-button:hover {
          background: var(--accent-hover);
        }

        @media (max-width: 768px) {
          .viewer-container {
            flex-direction: column;
            max-height: 100vh;
          }

          .viewer-info {
            width: 100%;
            border-left: none;
            border-top: 1px solid var(--border-subtle);
          }
        }
      `}</style>
    </div>
  );
}