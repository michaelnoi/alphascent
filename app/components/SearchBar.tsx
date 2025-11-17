'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Info } from 'lucide-react';

interface SearchBarProps {
  onSearchChange: (query: string, scope: 'all' | 'current') => void;
  initialQuery?: string;
  initialScope?: 'all' | 'current';
}

interface SearchInfoPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

function SearchInfoPopup({ isOpen, onClose }: SearchInfoPopupProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 backdrop-blur-sm">
        <div className="text-xs text-gray-600 space-y-2.5">
          <p className="text-gray-900 font-medium leading-relaxed">
            Full-text search across <span className="font-semibold text-gray-900">titles</span>, <span className="font-semibold text-gray-900">abstracts</span>, and <span className="font-semibold text-gray-900">authors</span>.
          </p>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-1.5 font-medium">Scope</p>
            <div className="space-y-1.5 text-gray-700">
              <div>
                <span className="font-semibold text-gray-900">In Date Range:</span> Current selection only
              </div>
              <div>
                <span className="font-semibold text-gray-900">All Papers:</span> Entire category history
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function SearchBar({ onSearchChange, initialQuery = '', initialScope = 'current' }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<'all' | 'current'>(initialScope);
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(query, scope);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, scope, onSearchChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          });
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
      if (searchBarRef.current && !searchBarRef.current.contains(e.target as Node)) {
        inputRef.current?.blur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearchChange(query, scope);
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  const handleInputClick = () => {
    inputRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const toggleScope = () => {
    setScope(prev => prev === 'all' ? 'current' : 'all');
  };

  const placeholderText = scope === 'all' 
    ? 'Search in all papers...' 
    : 'Search in papers in date range...';

  return (
    <div ref={searchBarRef} className="flex gap-2 items-center">
      <div className="relative flex-1">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={handleInputClick}
          placeholder={placeholderText}
          className="w-full pl-10 pr-10 py-2 border border-gray-200 bg-white/80 backdrop-blur-sm rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm cursor-text"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <div className="relative" ref={infoRef}>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-2 text-gray-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-gray-50"
          aria-label="Search information"
          title="Search information"
        >
          <Info className="w-4 h-4" />
        </button>
        <SearchInfoPopup isOpen={showInfo} onClose={() => setShowInfo(false)} />
      </div>
      
      <button
        onClick={toggleScope}
        className={`
          px-3 py-2 rounded-lg text-xs font-medium transition-all shadow-sm border
          ${scope === 'all' 
            ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200' 
            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
          }
        `}
        title="Toggle search scope"
      >
        {scope === 'all' ? 'All Papers' : 'In Date Range'}
      </button>
    </div>
  );
}
