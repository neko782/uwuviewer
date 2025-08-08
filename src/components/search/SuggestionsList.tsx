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
      </div>
    );
  }
);

SuggestionsList.displayName = 'SuggestionsList';

export default SuggestionsList;
