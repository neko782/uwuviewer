'use client';

import { MoebooruPost } from '@/lib/api';
import { proxyImageUrl } from '@/lib/imageProxy';
import { useState } from 'react';

interface ImageCardProps {
  post: MoebooruPost;
  onClick: () => void;
}

const ratingConfig = {
  s: { label: 'Safe', color: '#4ade80', bg: '#166534' },
  q: { label: 'Questionable', color: '#fbbf24', bg: '#713f12' },
  e: { label: 'Explicit', color: '#f87171', bg: '#7f1d1d' }
};

export default function ImageCard({ post, onClick }: ImageCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const rating = ratingConfig[post.rating as keyof typeof ratingConfig] || ratingConfig.s;

  return (
    <div
      className="image-card"
      onClick={onClick}
    >
      {!imageLoaded && !imageError && (
        <div className="image-placeholder">
          <div className="loading-spinner">
            <svg className="spinner-icon" viewBox="0 0 24 24" fill="none">
              <circle 
                className="spinner-track"
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="3"
                opacity="0.25"
              />
              <circle 
                className="spinner-fill"
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="60"
                strokeDashoffset="15"
              />
            </svg>
          </div>
        </div>
      )}
      
      {!imageError && (
        <img
          src={proxyImageUrl(post.preview_url)}
          alt={`Post ${post.id}`}
          className={`image-preview ${imageLoaded ? 'loaded' : ''}`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          loading="lazy"
        />
      )}

      {imageError && (
        <div className="image-error">
          <span>Failed to load</span>
        </div>
      )}

      <div className="rating-badge" style={{ 
        backgroundColor: rating.bg,
        color: rating.color
      }}>
        {rating.label}
      </div>

      <div className="score-badge">
        ★ {post.score}
      </div>

      <div className="image-overlay" />

      <style jsx>{`
        .image-card {
          position: relative;
          background: var(--bg-secondary);
          border-radius: var(--radius-sm);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          width: 100%;
          break-inside: avoid;
          margin-bottom: 16px;
          display: inline-block;
        }

        .image-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .image-card:hover .image-overlay {
          opacity: 1;
        }

        .image-placeholder {
          position: absolute;
          inset: 0;
          background: var(--bg-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          color: var(--text-dim);
        }

        .spinner-icon {
          width: 100%;
          height: 100%;
          animation: spin 1s linear infinite;
        }

        .spinner-fill {
          transform-origin: center;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .image-preview {
          width: 100%;
          height: auto;
          display: block;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .image-preview.loaded {
          opacity: 1;
        }

        .image-error {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary);
          color: var(--text-dim);
          font-size: 14px;
        }

        .image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            transparent 60%,
            rgba(0, 0, 0, 0.8) 100%
          );
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }

        .rating-badge {
          position: absolute;
          bottom: 8px;
          left: 8px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          z-index: 1;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .score-badge {
          position: absolute;
          bottom: 8px;
          right: 8px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          background: rgba(0, 0, 0, 0.7);
          color: var(--text-primary);
          z-index: 1;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}