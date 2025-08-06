'use client';

import { useState, useEffect } from 'react';

interface PaginationProps {
  currentPage: number;
  hasMore: boolean;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  hasMore,
  loading,
  onPageChange
}: PaginationProps) {
  const [inputValue, setInputValue] = useState(currentPage.toString());

  useEffect(() => {
    setInputValue(currentPage.toString());
  }, [currentPage]);

  const handlePrevious = () => {
    if (currentPage > 1 && !loading) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (hasMore && !loading) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const pageNum = parseInt(inputValue);
      if (!isNaN(pageNum) && pageNum > 0 && pageNum !== currentPage && !loading) {
        onPageChange(pageNum);
      }
    }
  };

  return (
    <div className="pagination">
      <button
        className="pagination-button"
        onClick={handlePrevious}
        disabled={currentPage === 1 || loading}
        aria-label="Previous page"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" 
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className="pagination-info">
        <span className="pagination-label">Page</span>
        <input
          type="number"
          className="pagination-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handlePageInput}
          disabled={loading}
          min="1"
        />
      </div>

      <button
        className="pagination-button"
        onClick={handleNext}
        disabled={!hasMore || loading}
        aria-label="Next page"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 18l6-6-6-6" 
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <style jsx>{`
        .pagination {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pagination-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .pagination-button:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-default);
        }

        .pagination-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pagination-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pagination-label {
          font-size: 13px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .pagination-input {
          width: 60px;
          padding: 6px 8px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 13px;
          text-align: center;
          transition: all 0.2s ease;
        }

        .pagination-input:focus {
          outline: none;
          border-color: var(--accent-dim);
          background: var(--bg-secondary);
        }

        .pagination-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .pagination-input::-webkit-inner-spin-button,
        .pagination-input::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .pagination-input[type=number] {
          -moz-appearance: textfield;
        }

        @media (max-width: 768px) {
          .pagination-button {
            width: 32px;
            height: 32px;
          }

          .pagination-input {
            width: 50px;
            font-size: 12px;
          }

          .pagination-label {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}