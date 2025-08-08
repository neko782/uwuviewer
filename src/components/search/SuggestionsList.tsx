'use client';

import React from 'react';

export interface TagSuggestion {
  name: string;
  value?: string;
  count: number;
  type: number;
  color: string;
}

interface SuggestionsListProps {
  suggestions: TagSuggestion[];
  selectedIndex: number;
  onSelect: (s: TagSuggestion) => void;
  onHover: (index: number) => void;
}

const SuggestionsList = React.forwardRef<HTMLDivElement, SuggestionsListProps>(
  ({ suggestions, selectedIndex, onSelect, onHover }, ref) => {
    if (!suggestions.length) return null;
    return (
      <div ref={ref} className="autocomplete-dropdown">
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.name}
            className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(suggestion);
            }}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHover(index)}
          >
            <span className="tag-name" style={{ color: suggestion.color }}>
              {suggestion.name}
            </span>
            <span className="tag-count">{suggestion.count.toLocaleString()}</span>
          </div>
        ))}
        <style jsx>{`
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
        `}</style>
      </div>
    );
  }
);

SuggestionsList.displayName = 'SuggestionsList';

export default SuggestionsList;
