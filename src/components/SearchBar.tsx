'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Site } from '@/lib/api';
import Image from 'next/image';
import Pagination from './Pagination';

interface TagSuggestion {
  name: string;
  count: number;
  type: number;
  color: string;
}

interface SearchBarProps {
  onSearch: (tags: string) => void;
  onSiteChange: (site: Site) => void;
  onPageChange: (page: number) => void;
  onImageTypeChange: (imageType: 'preview' | 'sample') => void;
  onApiKeyChange: (apiKey: string) => void;
  currentSite: Site;
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
  onPageChange,
  onImageTypeChange,
  onApiKeyChange,
  currentSite,
  currentPage,
  currentImageType,
  currentApiKey,
  hasMore,
  loading,
  searchTags = ''
}: SearchBarProps) {
  const sites: { value: Site; label: string; icon: string; needsApiKey?: boolean; defaultRating: string }[] = [
    { value: 'yande.re', label: 'Yande.re', icon: '/yandere.ico', defaultRating: 'rating:safe' },
    { value: 'konachan.com', label: 'Konachan', icon: '/konachan.ico', defaultRating: 'rating:safe' },
    { value: 'gelbooru.com', label: 'Gelbooru', icon: '/gelbooru.ico', needsApiKey: true, defaultRating: 'rating:general' }
  ];

  const currentSiteData = sites.find(s => s.value === currentSite) || sites[0];
  const [searchInput, setSearchInput] = useState(searchTags || currentSiteData.defaultRating);
  const [showFilters, setShowFilters] = useState(false);
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(currentApiKey);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const filterRef = useRef<HTMLDivElement>(null);
  const siteDropdownRef = useRef<HTMLDivElement>(null);
  const mobileSiteDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSearchInput(searchTags);
  }, [searchTags]);

  useEffect(() => {
    // When site changes, update the search input if it's empty or only contains a rating
    const trimmedInput = searchInput.trim();
    const isOnlyRating = trimmedInput === 'rating:safe' || 
                         trimmedInput === 'rating:general' || 
                         trimmedInput === '';
    
    if (isOnlyRating) {
      const newSiteData = sites.find(s => s.value === currentSite);
      if (newSiteData) {
        setSearchInput(newSiteData.defaultRating);
      }
    }
  }, [currentSite]); // Only run when currentSite changes, not on every searchInput change

  useEffect(() => {
    setApiKeyInput(currentApiKey);
  }, [currentApiKey]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Only fetch for yande.re and konachan
    if (currentSite !== 'yande.re' && currentSite !== 'konachan.com') {
      return;
    }

    try {
      const response = await fetch(
        `/api/autocomplete?q=${encodeURIComponent(query)}&site=${currentSite}&apiKey=${currentApiKey}`
      );
      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setShowSuggestions(data.suggestions && data.suggestions.length > 0);
      setSelectedSuggestionIndex(-1);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [currentSite, currentApiKey]);

  const getTagAtCursor = useCallback((input: string, cursorPos: number) => {
    // Find the start of the current tag (after the last space before cursor, or start of string)
    let tagStart = input.lastIndexOf(' ', cursorPos - 1) + 1;
    
    // Find the end of the current tag (next space after cursor, or end of string)
    let tagEnd = input.indexOf(' ', cursorPos);
    if (tagEnd === -1) tagEnd = input.length;
    
    const currentTag = input.substring(tagStart, tagEnd);
    return { tag: currentTag, start: tagStart, end: tagEnd };
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setSearchInput(value);
    setCursorPosition(cursorPos);
    
    // Get the tag at the cursor position
    const { tag } = getTagAtCursor(value, cursorPos);
    
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(tag);
    }, 300);
  }, [fetchSuggestions, getTagAtCursor]);

  const applySuggestion = useCallback((suggestion: TagSuggestion) => {
    const { start, end } = getTagAtCursor(searchInput, cursorPosition);
    const newValue = searchInput.substring(0, start) + suggestion.name + searchInput.substring(end);
    setSearchInput(newValue);
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Focus back on input and set cursor position after the inserted tag
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      const newCursorPos = start + suggestion.name.length;
      setTimeout(() => {
        searchInputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  }, [searchInput, cursorPosition, getTagAtCursor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      applySuggestion(suggestions[selectedSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSuggestions([]);
      setSelectedSuggestionIndex(-1);
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, applySuggestion]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
      if (siteDropdownRef.current && !siteDropdownRef.current.contains(event.target as Node) &&
          mobileSiteDropdownRef.current && !mobileSiteDropdownRef.current.contains(event.target as Node)) {
        setShowSiteDropdown(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
  };

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
        
        <div className="search-input-container">
          <input
            ref={searchInputRef}
            type="text"
            value={searchInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={(e) => {
              setCursorPosition(e.target.selectionStart || 0);
              const { tag } = getTagAtCursor(searchInput, e.target.selectionStart || 0);
              if (tag.length >= 2) {
                fetchSuggestions(tag);
              }
            }}
            placeholder="Search tags..."
            className="search-input"
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <div ref={suggestionsRef} className="autocomplete-dropdown">
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.name}
                  className={`autocomplete-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                  onClick={() => applySuggestion(suggestion)}
                  onMouseEnter={() => setSelectedSuggestionIndex(index)}
                >
                  <span 
                    className="tag-name"
                    style={{ color: suggestion.color }}
                  >
                    {suggestion.name}
                  </span>
                  <span className="tag-count">
                    {suggestion.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
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
        <div className="site-selector mobile-only" ref={mobileSiteDropdownRef}>
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

        .search-input-container {
          flex: 1;
          position: relative;
        }

        .search-input {
          width: 100%;
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

        .autocomplete-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          max-height: 300px;
          overflow-y: auto;
          z-index: 200;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          animation: dropIn 0.2s ease;
        }

        .autocomplete-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          cursor: pointer;
          transition: background 0.15s ease;
          border-bottom: 1px solid var(--border-subtle);
        }

        .autocomplete-item:last-child {
          border-bottom: none;
        }

        .autocomplete-item:hover,
        .autocomplete-item.selected {
          background: var(--bg-hover);
        }

        .tag-name {
          font-size: 14px;
          font-weight: 500;
          flex: 1;
          margin-right: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tag-count {
          font-size: 12px;
          color: var(--text-dim);
          background: var(--bg-tertiary);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          white-space: nowrap;
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

      {showApiKeyModal && typeof document !== 'undefined' && 
        ReactDOM.createPortal(
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
          </div>,
          document.body
        )
      }

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