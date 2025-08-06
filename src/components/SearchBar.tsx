'use client';

import { useState, useRef, useEffect } from 'react';
import { Site } from '@/lib/api';
import Image from 'next/image';
import Pagination from './Pagination';

interface SearchBarProps {
  onSearch: (tags: string) => void;
  onSiteChange: (site: Site) => void;
  onRatingChange: (rating: 's' | 'q' | 'e' | null) => void;
  onPageChange: (page: number) => void;
  onImageTypeChange: (imageType: 'preview' | 'sample') => void;
  onApiKeyChange: (apiKey: string) => void;
  currentSite: Site;
  currentRating: 's' | 'q' | 'e' | null;
  currentPage: number;
  currentImageType: 'preview' | 'sample';
  currentApiKey: string;
  hasMore: boolean;
  loading: boolean;
  searchTags?: string;
}

export default function SearchBar({
  onSearch,
  onSiteChange,
  onRatingChange,
  onPageChange,
  onImageTypeChange,
  onApiKeyChange,
  currentSite,
  currentRating,
  currentPage,
  currentImageType,
  currentApiKey,
  hasMore,
  loading,
  searchTags = ''
}: SearchBarProps) {
  const [searchInput, setSearchInput] = useState(searchTags);
  const [showFilters, setShowFilters] = useState(false);
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(currentApiKey);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const siteDropdownRef = useRef<HTMLDivElement>(null);

  const sites: { value: Site; label: string; icon: string; needsApiKey?: boolean }[] = [
    { value: 'yande.re', label: 'Yande.re', icon: '/yandere.ico' },
    { value: 'konachan.com', label: 'Konachan', icon: '/konachan.ico' },
    { value: 'gelbooru.com', label: 'Gelbooru', icon: '/gelbooru.ico', needsApiKey: true }
  ];

  useEffect(() => {
    setSearchInput(searchTags);
  }, [searchTags]);

  useEffect(() => {
    setApiKeyInput(currentApiKey);
  }, [currentApiKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
      if (siteDropdownRef.current && !siteDropdownRef.current.contains(event.target as Node)) {
        setShowSiteDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
  };

  const currentSiteData = sites.find(s => s.value === currentSite) || sites[0];

  return (
    <div className="search-container">
      <div className="search-row">
        <form onSubmit={handleSubmit} className="search-form">
        <div className="site-selector desktop-only" ref={siteDropdownRef}>
          <button
            type="button"
            className="site-selector-button"
            onClick={() => setShowSiteDropdown(!showSiteDropdown)}
          >
            <Image
              src={currentSiteData.icon}
              alt={currentSiteData.label}
              width={16}
              height={16}
              className="site-icon"
            />
            <span className="site-name-desktop">{currentSiteData.label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="dropdown-arrow">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {showSiteDropdown && (
            <div className="site-dropdown">
              {sites.map((site) => (
                <button
                  key={site.value}
                  type="button"
                  className={`site-option ${currentSite === site.value ? 'active' : ''}`}
                  onClick={() => {
                    onSiteChange(site.value);
                    setShowSiteDropdown(false);
                  }}
                >
                  <Image
                    src={site.icon}
                    alt={site.label}
                    width={16}
                    height={16}
                    className="site-icon"
                  />
                  <span>{site.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search tags..."
          className="search-input"
        />
        
        <button type="submit" className="search-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="filter-container" ref={filterRef}>
          <button
            type="button"
            className="filter-button"
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 4h18M3 12h18M3 20h18" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {showFilters && (
            <div className="filter-dropdown">
              <div className="filter-section">
                <label className="filter-label">Rating</label>
                <div className="filter-options">
                  <button
                    type="button"
                    className={`filter-option ${currentRating === null ? 'active' : ''}`}
                    onClick={() => onRatingChange(null)}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`filter-option ${currentRating === 's' ? 'active' : ''}`}
                    onClick={() => onRatingChange('s')}
                  >
                    Safe
                  </button>
                  <button
                    type="button"
                    className={`filter-option ${currentRating === 'q' ? 'active' : ''}`}
                    onClick={() => onRatingChange('q')}
                  >
                    Questionable
                  </button>
                  <button
                    type="button"
                    className={`filter-option ${currentRating === 'e' ? 'active' : ''}`}
                    onClick={() => onRatingChange('e')}
                  >
                    Explicit
                  </button>
                </div>
              </div>

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

              {currentSite === 'gelbooru.com' && (
                <div className="filter-section">
                  <label className="filter-label">API Key</label>
                  <button
                    type="button"
                    className="api-key-button"
                    onClick={() => setShowApiKeyModal(true)}
                  >
                    {currentApiKey ? 'API Key Set ✓' : 'Set API Key'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
      
      <div className="desktop-only">
        <Pagination
          currentPage={currentPage}
          hasMore={hasMore}
          loading={loading}
          onPageChange={onPageChange}
        />
      </div>
      </div>

      <div className="bottom-row mobile-only">
        <div className="site-selector mobile-only">
          <button
            type="button"
            className="site-selector-button"
            onClick={() => setShowSiteDropdown(!showSiteDropdown)}
          >
            <Image
              src={currentSiteData.icon}
              alt={currentSiteData.label}
              width={16}
              height={16}
              className="site-icon"
            />
            <span className="site-name">{currentSiteData.label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="dropdown-arrow">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {showSiteDropdown && (
            <div className="site-dropdown">
              {sites.map((site) => (
                <button
                  key={site.value}
                  type="button"
                  className={`site-option ${currentSite === site.value ? 'active' : ''}`}
                  onClick={() => {
                    onSiteChange(site.value);
                    setShowSiteDropdown(false);
                  }}
                >
                  <Image
                    src={site.icon}
                    alt={site.label}
                    width={16}
                    height={16}
                    className="site-icon"
                  />
                  <span>{site.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <Pagination
          currentPage={currentPage}
          hasMore={hasMore}
          loading={loading}
          onPageChange={onPageChange}
        />
      </div>

      <style jsx>{`
        .search-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        .search-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .desktop-only {
          display: block;
        }

        .mobile-only {
          display: none;
        }

        .bottom-row {
          display: none;
        }

        .search-form {
          display: flex;
          gap: 8px;
          position: relative;
          flex: 1;
          min-width: 300px;
          max-width: 500px;
          align-items: stretch;
        }

        .site-selector {
          position: relative;
          display: flex;
        }

        .site-selector-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease;
          white-space: nowrap;
          height: 100%;
        }

        .site-selector-button:hover {
          background: var(--bg-tertiary);
          border-color: var(--accent-dim);
        }

        :global(img.site-icon) {
          width: 16px;
          height: 16px;
          max-width: 16px;
          max-height: 16px;
        }

        .site-name {
          font-size: 14px;
          font-weight: 500;
        }

        .site-name-desktop {
          display: none;
        }

        .dropdown-arrow {
          opacity: 0.6;
          transition: transform 0.2s ease;
          margin-left: auto;
        }

        .site-selector-button:hover .dropdown-arrow {
          opacity: 1;
        }

        .site-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          background: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 4px;
          min-width: 100%;
          z-index: 100;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          animation: dropIn 0.2s ease;
        }

        .site-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .site-option:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .site-option.active {
          background: var(--accent);
          color: white;
          font-weight: 500;
        }

        .search-input {
          flex: 1;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 14px;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--accent-dim);
          background: var(--bg-tertiary);
        }

        .search-input::placeholder {
          color: var(--text-dim);
        }

        .search-button,
        .filter-button {
          padding: 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .search-button:hover,
        .filter-button:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .filter-container {
          position: relative;
        }

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

        @media (min-width: 769px) {
          .site-name-desktop {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .desktop-only {
            display: none !important;
          }

          .mobile-only {
            display: block;
          }

          .search-row {
            flex-direction: column;
            gap: 12px;
          }

          .search-form {
            min-width: 100%;
          }

          .bottom-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 12px;
            width: 100%;
          }

          .bottom-row .site-selector {
            flex: 1;
          }

          .bottom-row .site-selector-button {
            width: 100%;
            justify-content: space-between;
          }

          .bottom-row > :global(.pagination-container) {
            flex-shrink: 0;
          }
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
      `}</style>

      {showApiKeyModal && (
        <div className="modal-overlay" onClick={() => setShowApiKeyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Gelbooru API Key</h3>
            <p className="modal-description">
              Enter your Gelbooru API credentials. Format: &api_key=xxx&user_id=yyy
            </p>
            <input
              type="text"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="&api_key=your_key&user_id=your_id"
              className="api-key-input"
            />
            <div className="modal-buttons">
              <button
                onClick={() => {
                  onApiKeyChange(apiKeyInput);
                  setShowApiKeyModal(false);
                }}
                className="modal-button save"
              >
                Save
              </button>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="modal-button cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
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
          max-width: 500px;
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

        .api-key-input {
          width: 100%;
          padding: 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 14px;
          margin-bottom: 16px;
        }

        .api-key-input:focus {
          outline: none;
          border-color: var(--accent-dim);
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