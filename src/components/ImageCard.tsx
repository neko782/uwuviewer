'use client';

import { UnifiedPost, Site } from '@/lib/api';
import { proxyImageUrl } from '@/lib/imageProxy';
import { getRatingInfo } from '@/lib/constants';
import { useState } from 'react';

interface ImageCardProps {
  post: UnifiedPost;
  site?: Site;
  imageType?: 'preview' | 'sample';
  onClick: () => void;
}





export default function ImageCard({ post, site, imageType = 'preview', onClick }: ImageCardProps) {
  // Determine if the post is a video by checking file_url extension
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

  // Determine if the post is a GIF by checking file_url extension
  const isGif = (() => {
    const url = post.file_url || '';
    if (!url) return false;
    try {
      const u = new URL(url);
      const pathname = u.pathname.toLowerCase();
      return pathname.endsWith('.gif');
    } catch {
      const lower = url.toLowerCase();
      return lower.includes('.gif');
    }
  })();

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const rating = getRatingInfo(site, post.rating);
  // Use selected image type normally; do not force sample for Rule34
  const imageUrl = imageType === 'sample' ? post.sample_url : post.preview_url;
  const hasImage = !!imageUrl;
  
  // Calculate aspect ratio from the dimensions corresponding to the displayed image
  const ratioWidth = imageType === 'sample' ? post.width : post.preview_width;
  const ratioHeight = imageType === 'sample' ? post.height : post.preview_height;
  const aspectRatio = ratioHeight && ratioWidth
    ? (ratioHeight / ratioWidth) * 100
    : 133; // Default to 4:3 if dimensions not available

  return (
    <div
      className="image-card"
      onClick={onClick}
    >
      <div className="image-container" style={{ paddingBottom: `${aspectRatio}%` }}>
        {!hasImage && (
          <div className="image-error">
            <span>no image avalaible</span>
          </div>
        )}

        {hasImage && !imageLoaded && !imageError && (
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
        
        {hasImage && !imageError && (
          <img
            src={proxyImageUrl(imageUrl)}
            alt={`Post ${post.id}`}
            className={`image-preview ${imageLoaded ? 'loaded' : ''}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        )}

        {hasImage && imageError && (
          <div className="image-error">
            <span>Failed to load</span>
          </div>
        )}
      </div>

      {(isVideo || isGif) && (
        <div className="media-badge">
          {isVideo ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M7 6h7a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2V8a2 2 0 012-2zm9 3l4-2v10l-4-2V9z" />
            </svg>
          ) : (
            <span>GIF</span>
          )}
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

        .image-container {
          position: relative;
          width: 100%;
          background: var(--bg-secondary);
        }

        .image-placeholder {
          position: absolute;
          inset: 0;
          background: var(--bg-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
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
          position: absolute;
          top: 0;
          left: 0;
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
          z-index: 1;
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

        .media-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          z-index: 2;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
