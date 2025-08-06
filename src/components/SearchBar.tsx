'use client';

import { useState, useRef, useEffect } from 'react';
import { Site } from '@/lib/api';

interface SearchBarProps {
  onSearch: (tags: string) => void;
  onSiteChange: (site: Site) => void;
  onRatingChange: (rating: 's' | 'q' | 'e' | null) => void;
  currentSite: Site;
  currentRating: 's' | 'q' | 'e' | null;
}

export default function SearchBar({
  onSearch,
  onSiteChange,
  onRatingChange,
  currentSite,
  currentRating
}: SearchBarProps) {
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
  };

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} className="search-form">
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
                <label className="filter-label">Site</label>
                <div className="filter-options">
                  <button
                    type="button"
                    className={`filter-option ${currentSite === 'yande.re' ? 'active' : ''}`}
                    onClick={() => onSiteChange('yande.re')}
                  >
                    Yande.re
                  </button>
                  <button
                    type="button"
                    className={`filter-option ${currentSite === 'konachan.com' ? 'active' : ''}`}
                    onClick={() => onSiteChange('konachan.com')}
                  >
                    Konachan
                  </button>
                </div>
              </div>

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
            </div>
          )}
        </div>
      </form>

      <style jsx>{`
        .search-container {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
        }

        .search-form {
          display: flex;
          gap: 8px;
          position: relative;
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
      `}</style>
    </div>
  );
}