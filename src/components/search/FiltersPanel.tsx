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
    </div>
  );
}
