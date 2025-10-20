'use client';

import { useState, useEffect, useRef } from 'react';

interface FiltersProps {
  onFilterChange: (query: string) => void;
  resultCount: number;
  totalCount: number;
}

export function Filters({ onFilterChange, resultCount, totalCount }: FiltersProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange(query);
    }, 150);

    return () => clearTimeout(timer);
  }, [query, onFilterChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClear = () => {
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="mb-8">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Filter by title, abstract, or authors..."
          className="w-full pl-10 pr-10 py-3 border border-gray-200 bg-white/80 backdrop-blur-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 text-lg transition-colors"
            aria-label="Clear filter"
          >
            ×
          </button>
        )}
      </div>
      <div className="mt-2.5 text-xs text-gray-500 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
        {resultCount} of {totalCount} papers
      </div>
    </div>
  );
}

