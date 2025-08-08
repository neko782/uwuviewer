'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Site } from '@/lib/api';
import Image from 'next/image';
import { SITE_CONFIG, DEFAULT_RATING_BY_SITE } from '@/lib/constants';
import Pagination from './Pagination';
import SuggestionsList from './search/SuggestionsList';
import ApiKeyModal from './search/ApiKeyModal';
import E621CredentialsModal from './search/E621CredentialsModal';
import FiltersPanel from './search/FiltersPanel';
import SettingsModal from './search/SettingsModal';

interface TagSuggestion {
  name: string;     // display label (may include alias → canonical)
  value?: string;   // text to insert (canonical tag)
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
  onE621AuthChange: (login: string, apiKey: string) => void;
  // onDownloadTags: (site: Site) => void;
  onLimitChange: (limit: number) => void;
  currentSite: Site;
  currentPage: number;
  currentImageType: 'preview' | 'sample';
  currentApiKey: string;
  currentE621Login: string;
  currentE621ApiKey: string;
  currentLimit: number;
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
  onE621AuthChange,
  
  onLimitChange,
  currentSite,
  currentPage,
  currentImageType,
  currentApiKey,
  currentE621Login,
  currentE621ApiKey,
  currentLimit,
  hasMore,
  loading,
  searchTags = ''
}: SearchBarProps) {
  const sites = SITE_CONFIG;

  const currentSiteData = sites.find(s => s.value === currentSite) || sites[0];
  const [searchInput, setSearchInput] = useState(searchTags || DEFAULT_RATING_BY_SITE[currentSite] || '');
  const [showFilters, setShowFilters] = useState(false);
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(currentApiKey);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [e621LoginInput, setE621LoginInput] = useState(currentE621Login);
  const [e621ApiKeyInput, setE621ApiKeyInput] = useState(currentE621ApiKey);
  const [showE621Modal, setShowE621Modal] = useState(false);
  const [hasGelbooruCreds, setHasGelbooruCreds] = useState(false);
  const [hasE621Creds, setHasE621Creds] = useState(false);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const mobileFilterRef = useRef<HTMLDivElement>(null);
  const siteDropdownRef = useRef<HTMLDivElement>(null);
  const mobileSiteDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
   const suggestionsRef = useRef<HTMLDivElement>(null);
   const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isApplyingSuggestionRef = useRef(false);

  useEffect(() => {
    setSearchInput(searchTags);
  }, [searchTags]);


  useEffect(() => {
    setApiKeyInput(currentApiKey);
  }, [currentApiKey]);

  useEffect(() => {
    setE621LoginInput(currentE621Login);
    setE621ApiKeyInput(currentE621ApiKey);
  }, [currentE621Login, currentE621ApiKey]);

  // Reflect server-stored credential presence via endpoint
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/creds');
        const data = await res.json();
        setHasGelbooruCreds(!!data.gelbooru);
        setHasE621Creds(!!data.e621);
      } catch {}
    })();
  }, []);



  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/autocomplete?q=${encodeURIComponent(query)}&site=${currentSite}`
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
  }, [currentSite]);

  const getTagAtCursor = useCallback((input: string, cursorPos: number) => {
    // Find the start of the current tag (after the last space before cursor, or start of string)
    const tagStart = input.lastIndexOf(' ', cursorPos - 1) + 1;
    
    // For autocompletion, we only want to complete up to the cursor position
    // not the entire tag that might extend beyond the cursor
    const tagEnd = cursorPos;
    
    const currentTag = input.substring(tagStart, tagEnd);
    return { tag: currentTag, start: tagStart, end: tagEnd };
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setSearchInput(value);
    setCursorPosition(cursorPos);
    
    // If we're applying a suggestion, don't do anything else
    if (isApplyingSuggestionRef.current) {
      return;
    }
    
    // Get the tag at the cursor position
    const { tag } = getTagAtCursor(value, cursorPos);
    
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // If the cursor is right after a space or the tag is empty, hide suggestions
    if (tag.trim() === '' || value[cursorPos - 1] === ' ') {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    // Set debounce based on site (debounce only for Gelbooru)
    const delay = currentSite === 'gelbooru.com' ? 1000 : 0;
    if (delay === 0) {
      fetchSuggestions(tag);
    } else {
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(tag);
      }, delay);
    }
  }, [fetchSuggestions, getTagAtCursor, currentSite]);

  const applySuggestion = useCallback((suggestion: TagSuggestion) => {
    // Clear any pending debounce timer first
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // Set flag before making any changes
    isApplyingSuggestionRef.current = true;
    
    const { start } = getTagAtCursor(searchInput, cursorPosition);
    // Insert the suggestion at the cursor position, replacing only what was typed
    // and add a space after the suggestion
    const beforeCursor = searchInput.substring(0, start);
    const afterCursor = searchInput.substring(cursorPosition);
    const toInsert = suggestion.value || suggestion.name;
    const newValue = beforeCursor + toInsert + ' ' + afterCursor;
    const newCursorPos = start + toInsert.length + 1; // +1 for the space
    
    // Hide suggestions immediately
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Update the input value
    setSearchInput(newValue);
    setCursorPosition(newCursorPos);
    
    // Focus back on input and set cursor position after the inserted tag and space
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      // Use requestAnimationFrame to ensure this happens after React's render
      requestAnimationFrame(() => {
        if (searchInputRef.current) {
          searchInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
        // Reset the flag after everything is done
        isApplyingSuggestionRef.current = false;
      });
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
      const target = event.target as Node;
      const outsideDesktopFilter = !filterRef.current || !filterRef.current.contains(target);
      const outsideMobileFilter = !mobileFilterRef.current || !mobileFilterRef.current.contains(target);
      if (outsideDesktopFilter && outsideMobileFilter) {
        setShowFilters(false);
      }
      if (siteDropdownRef.current && !siteDropdownRef.current.contains(target) &&
          mobileSiteDropdownRef.current && !mobileSiteDropdownRef.current.contains(target)) {
        setShowSiteDropdown(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(target) &&
          searchInputRef.current && !searchInputRef.current.contains(target)) {
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
              const cursorPos = e.target.selectionStart || 0;
              setCursorPosition(cursorPos);
              // Don't fetch if cursor is right after a space
              if (searchInput[cursorPos - 1] !== ' ') {
                const { tag } = getTagAtCursor(searchInput, cursorPos);
                if (tag.length >= 2) {
                  fetchSuggestions(tag);
                }
              }
            }}
            onBlur={() => {
              // Hide suggestions when input loses focus
              // The timeout allows click events on suggestions to fire first
              setTimeout(() => {
                if (!isApplyingSuggestionRef.current) {
                  setShowSuggestions(false);
                }
              }, 200);
            }}
            placeholder="Search tags..."
            className="search-input"
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <SuggestionsList
              ref={suggestionsRef}
              suggestions={suggestions}
              selectedIndex={selectedSuggestionIndex}
              onSelect={(s) => applySuggestion(s)}
              onHover={(i) => setSelectedSuggestionIndex(i)}
            />
          )}
        </div>
        
        <button type="submit" className="search-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="filter-container desktop-only" ref={filterRef}>
          <button
            type="button"
            className="filter-button"
            onClick={() => setShowFilters(!showFilters)}
            title="Filters"
            aria-label="Open filters"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 4h18M3 12h18M3 20h18" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

              {showFilters && (
                <FiltersPanel
                  currentImageType={currentImageType}
                  onImageTypeChange={onImageTypeChange}
                  currentLimit={currentLimit}
                  onLimitChange={onLimitChange}
                  currentSite={currentSite}
                  onOpenGelbooru={() => setShowApiKeyModal(true)}
                  onOpenE621={() => setShowE621Modal(true)}
                  hasGelbooruCreds={hasGelbooruCreds}
                  hasE621Creds={hasE621Creds}
                  onOpenSettings={() => {
                    setShowSettings(true);
                    setShowFilters(false);
                  }}
                />
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

      {/* Mobile floating filters (hamburger) in top-right */}
      <div className="mobile-filter-fab mobile-only" ref={mobileFilterRef}>
        <button
          type="button"
          className="mobile-filter-button"
          onClick={() => setShowFilters(!showFilters)}
          title="Filters"
          aria-label="Open filters"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 4h18M3 12h18M3 20h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        {showFilters && (
          <FiltersPanel
            currentImageType={currentImageType}
            onImageTypeChange={onImageTypeChange}
            currentLimit={currentLimit}
            onLimitChange={onLimitChange}
            currentSite={currentSite}
            onOpenGelbooru={() => setShowApiKeyModal(true)}
            onOpenE621={() => setShowE621Modal(true)}
            hasGelbooruCreds={hasGelbooruCreds}
            hasE621Creds={hasE621Creds}
            onOpenSettings={() => {
              setShowSettings(true);
              setShowFilters(false);
            }}
          />
        )}
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

        .mobile-filter-fab {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 101;
        }

        .mobile-filter-button {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .mobile-filter-button:hover {
          background: var(--bg-tertiary);
          transform: scale(1.05);
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

      {showApiKeyModal && typeof document !== 'undefined' && 
        ReactDOM.createPortal(
          <ApiKeyModal
            apiKeyInput={apiKeyInput}
            onChange={(v) => setApiKeyInput(v)}
            onSave={async () => {
              try {
                await fetch('/api/creds', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ gelbooruApi: apiKeyInput }),
                });
                const res = await fetch('/api/creds');
                const data = await res.json();
                setHasGelbooruCreds(!!data.gelbooru);
              } catch {}
              onApiKeyChange('');
              setApiKeyInput('');
              setShowApiKeyModal(false);
            }}
            onClear={async () => {
              try {
                await fetch('/api/creds', { method: 'DELETE' });
                const res = await fetch('/api/creds');
                const data = await res.json();
                setHasGelbooruCreds(!!data.gelbooru);
              } catch {}
            }}
            onClose={() => setShowApiKeyModal(false)}
          />, document.body)
      }

      {showE621Modal && typeof document !== 'undefined' &&
        ReactDOM.createPortal(
          <E621CredentialsModal
            login={e621LoginInput}
            apiKey={e621ApiKeyInput}
            onChangeLogin={setE621LoginInput}
            onChangeKey={setE621ApiKeyInput}
            onSave={async () => {
              try {
                await fetch('/api/creds', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ e621Login: e621LoginInput, e621ApiKey: e621ApiKeyInput }),
                });
                const res = await fetch('/api/creds');
                const data = await res.json();
                setHasE621Creds(!!data.e621);
              } catch {}
              onE621AuthChange('', '');
              setE621LoginInput('');
              setE621ApiKeyInput('');
              setShowE621Modal(false);
            }}
            onClear={async () => {
              try {
                await fetch('/api/creds', { method: 'DELETE' });
                const res = await fetch('/api/creds');
                const data = await res.json();
                setHasE621Creds(!!data.e621);
              } catch {}
            }}
            onClose={() => setShowE621Modal(false)}
          />, document.body)
      }

      {showSettings && typeof document !== 'undefined' &&
        ReactDOM.createPortal(
          <SettingsModal onClose={() => setShowSettings(false)} />,
          document.body
        )
      }

    </div>
  );
}