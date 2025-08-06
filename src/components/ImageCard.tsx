'use client';

import { MoebooruPost } from '@/lib/api';
import { useState } from 'react';

interface ImageCardProps {
  post: MoebooruPost;
  onClick: () => void;
}

export default function ImageCard({ post, onClick }: ImageCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const aspectRatio = post.preview_height / post.preview_width;
  const displayHeight = Math.round(250 * aspectRatio);

  return (
    <div
      className="image-card"
      onClick={onClick}
      style={{ height: `${displayHeight}px` }}
    >
      {!imageLoaded && !imageError && (
        <div className="image-placeholder" />
      )}
      
      {!imageError && (
        <img
          src={post.preview_url}
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

      <div className="image-overlay">
        <div className="image-info">
          <span className="image-rating">{post.rating.toUpperCase()}</span>
          <span className="image-score">★ {post.score}</span>
        </div>
      </div>

      <style jsx>{`
        .image-card {
          position: relative;
          background: var(--bg-secondary);
          border-radius: var(--radius-sm);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          width: 100%;
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
          background: linear-gradient(
            135deg,
            var(--bg-secondary) 0%,
            var(--bg-tertiary) 50%,
            var(--bg-secondary) 100%
          );
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }

        .image-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
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

        .image-info {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 500;
        }

        .image-rating {
          padding: 2px 6px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          opacity: 0.9;
        }

        .image-score {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}