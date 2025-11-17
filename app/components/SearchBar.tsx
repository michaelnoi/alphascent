'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearchChange: (query: string, scope: 'all' | 'current') => void;
  initialQuery?: string;
  initialScope?: 'all' | 'current';
}

export function SearchBar({ onSearchChange, initialQuery = '', initialScope = 'all' }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<'all' | 'current'>(initialScope);
  const [isTextInputEnabled, setIsTextInputEnabled] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isTextInputEnabled) {
      const timer = setTimeout(() => {
        onSearchChange(query, scope);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [query, scope, onSearchChange, isTextInputEnabled]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsTextInputEnabled(true);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearchChange(query, scope);
      setIsTextInputEnabled(false);
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      inputRef.current?.blur();
      setIsTextInputEnabled(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isTextInputEnabled) {
      setQuery(e.target.value);
    }
  };

  const handleClear = () => {
    setQuery('');
    if (isTextInputEnabled) {
      inputRef.current?.focus();
    }
  };

  const toggleScope = () => {
    setScope(prev => prev === 'all' ? 'current' : 'all');
  };

  return (
    <div className="flex gap-2 items-center">
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
          placeholder={isTextInputEnabled ? "Search papers... (Press Enter to search, Esc to cancel)" : "Press ⌘F to search"}
          disabled={!isTextInputEnabled}
          className={`
            w-full pl-10 pr-10 py-2 border border-gray-200 bg-white/80 backdrop-blur-sm rounded-lg text-sm 
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm
            ${!isTextInputEnabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
          `}
        />
        {query && isTextInputEnabled && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
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
        {scope === 'all' ? 'All papers' : 'Current view'}
      </button>
    </div>
  );
}
