'use client';

import React from 'react';
import { Site } from '@/lib/api';

interface FiltersPanelProps {
  currentImageType: 'preview' | 'sample';
  onImageTypeChange: (t: 'preview' | 'sample') => void;
  currentLimit: number;
  onLimitChange: (n: number) => void;
  currentSite: Site;
  onOpenGelbooru: () => void;
  onOpenE621: () => void;
  hasGelbooruCreds: boolean;
  hasE621Creds: boolean;
  showDownloadOption: boolean;
  onDownloadTags: () => void;
}

export default function FiltersPanel({ currentImageType, onImageTypeChange, currentLimit, onLimitChange, currentSite, onOpenGelbooru, onOpenE621, hasGelbooruCreds, hasE621Creds, showDownloadOption, onDownloadTags }: FiltersPanelProps) {
  return (
    <div className="filter-dropdown">
      <div className="filter-section">
        <label className="filter-label">Image Quality</label>
        <div className="filter-options">
          <button
            type="button"
            className={`filter-option ${currentImageType === 'preview' ? 'active' : ''}`}
            onClick={() => onImageTypeChange('preview')}
          >
            Preview (Fast)
          </button>
          <button
            type="button"
            className={`filter-option ${currentImageType === 'sample' ? 'active' : ''}`}
            onClick={() => onImageTypeChange('sample')}
          >
            Sample (HQ)
          </button>
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Posts per page</label>
        <input
          type="number"
          min={1}
          step={1}
          value={currentLimit}
          onChange={(e) => {
            const v = parseInt(e.target.value || '0', 10);
            if (!Number.isNaN(v) && v > 0) onLimitChange(v);
          }}
          className="limit-input"
        />
      </div>

      {currentSite === 'gelbooru.com' && (
        <div className="filter-section">
          <label className="filter-label">API Key</label>
          <button type="button" className="api-key-button" onClick={onOpenGelbooru}>
            {hasGelbooruCreds ? 'API Key Set ✓' : 'Set API Key'}
          </button>
        </div>
      )}

      {currentSite === 'e621.net' && (
        <div className="filter-section">
          <label className="filter-label">e621 Credentials</label>
          <button type="button" className="api-key-button" onClick={onOpenE621}>
            {hasE621Creds ? 'Credentials Set ✓' : 'Set Credentials'}
          </button>
        </div>
      )}

      {showDownloadOption && (
        <div className="filter-section">
          <label className="filter-label">Tag Cache</label>
          <button type="button" className="api-key-button" onClick={onDownloadTags}>
            Download tag cache
          </button>
        </div>
      )}
      <style jsx>{`
        .filter-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 16px;
          min-width: 280px;
          z-index: 100;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          animation: dropIn 0.2s ease;
        }

        @keyframes dropIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .filter-section {
          margin-bottom: 16px;
        }

        .filter-section:last-child {
          margin-bottom: 0;
        }

        .filter-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .filter-options {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .filter-option {
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .filter-option:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .filter-option.active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        .filter-option.active:hover {
          background: var(--accent-hover);
          border-color: var(--accent-hover);
        }

        .api-key-button {
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
        }

        .api-key-button:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .limit-input {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 13px;
        }
        .limit-input:focus {
          outline: none;
          border-color: var(--accent-dim);
          background: var(--bg-secondary);
        }
        .limit-input::-webkit-inner-spin-button,
        .limit-input::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .limit-input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
