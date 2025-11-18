'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PaperCard, type PaperFromAPI } from '@/app/components/PaperCard';
import { SearchBar } from '@/app/components/SearchBar';
import { DatePicker } from '@/app/components/DatePicker';
import { useKeyboardNav } from '@/app/components/useKeyboardNav';
import { KeyboardShortcuts } from '@/app/components/KeyboardShortcuts';
import { Keyboard, ChevronDown } from 'lucide-react';
import { getAllCategories } from '@/app/lib/categories';

interface DateInfo {
  date: string;
  count: number;
}

interface PapersResponse {
  papers: PaperFromAPI[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    date?: string;
    from?: string;
    to?: string;
    search?: string;
    searchScope?: string;
  };
}

interface CategoryPageProps {
  category: string;
  displayName: string;
}

export default function CategoryPage({ category, displayName }: CategoryPageProps) {
  const router = useRouter();
  const [papers, setPapers] = useState<PaperFromAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [availableDates, setAvailableDates] = useState<DateInfo[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'current'>('current');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    hasMore: false,
  });

  const { activeIndex, setActiveIndex } = useKeyboardNav(papers.length);
  
  const categories = getAllCategories();

  useEffect(() => {
    async function loadDates() {
      try {
        const res = await fetch(`/api/dates?category=${encodeURIComponent(category)}`);
        if (!res.ok) throw new Error('Failed to fetch dates');
        const data = await res.json();
        setAvailableDates(data.dates);
        if (data.dates.length > 0 && !selectedDate && !dateRange) {
          setSelectedDate(data.dates[0].date);
        } else if (data.dates.length === 0) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading dates:', err);
        setLoading(false);
      }
    }
    loadDates();
  }, [category]);

  const fetchPapers = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      const params = new URLSearchParams({
        category: category,
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchQuery) {
        params.set('search', searchQuery);
        params.set('searchScope', searchScope);
      }

      if (dateRange) {
        params.set('from', dateRange.from);
        params.set('to', dateRange.to);
      } else if (selectedDate) {
        params.set('date', selectedDate);
      }

      const res = await fetch(`/api/papers?${params}`);
      if (!res.ok) throw new Error(`Failed to fetch papers: ${res.status}`);
      
      const data: PapersResponse = await res.json();
      
      if (append) {
        setPapers(prev => [...prev, ...data.papers]);
      } else {
        setPapers(data.papers);
      }
      
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load papers');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [category, selectedDate, dateRange, searchQuery, searchScope, pagination.limit]);

  useEffect(() => {
    if (selectedDate || dateRange) {
      fetchPapers(1, false);
    }
  }, [selectedDate, dateRange, searchQuery, searchScope]);

  const handleSearchChange = useCallback((query: string, scope: 'all' | 'current') => {
    setSearchQuery(query);
    setSearchScope(scope);
  }, []);

  const handleDateSelect = useCallback((date: string | null) => {
    setSelectedDate(date);
    setDateRange(null);
  }, []);

  const handleDateRangeSelect = useCallback((from: string, to: string) => {
    setDateRange({ from, to });
    setSelectedDate(null);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (pagination.hasMore && !loadingMore) {
      fetchPapers(pagination.page + 1, true);
    }
  }, [pagination, loadingMore, fetchPapers]);

  const handlePaperClick = useCallback((index: number) => {
    setActiveIndex(index);
    setExpandedIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.clear();
        newSet.add(index);
      }
      return newSet;
    });
  }, [setActiveIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCategoryDropdown]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'M' && e.shiftKey) {
        e.preventDefault();
        handleLoadMore();
      }
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleLoadMore]);

  const handleCategorySelect = (categorySlug: string) => {
    setShowCategoryDropdown(false);
    router.push(`/${categorySlug.toLowerCase()}`);
  };

  const progressPercent = papers.length > 0 ? Math.round(((activeIndex + 1) / papers.length) * 100) : 0;

  if (loading && papers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <div className="text-sm text-gray-500">Loading papers...</div>
        </div>
      </div>
    );
  }

  if (error && papers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-base font-semibold text-gray-900 mb-2">Error loading papers</div>
          <div className="text-sm text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  if (!loading && availableDates.length === 0 && papers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-base font-semibold text-gray-900 mb-2">No papers yet</div>
          <div className="text-sm text-gray-600 mb-4">The database is empty. Add papers.</div>
          <div className="text-xs text-gray-500">API is working correctly - waiting for data.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      
      <div className="sticky top-0 z-40 bg-[#fffaf3]/95 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-5">
          <div className="flex items-center justify-between gap-6 mb-4">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  AlphaScent
                </h1>
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="text-xs text-gray-500 flex items-center gap-2 hover:text-gray-700 transition-colors"
                  >
                    <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    {category} papers
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showCategoryDropdown && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[180px] py-1">
                      {categories.map((cat) => (
                        <button
                          key={cat.slug}
                          onClick={() => handleCategorySelect(cat.slug)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                            cat.id === category ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          {cat.id} - {cat.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1 text-xs text-gray-600 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2">
                <span className="font-medium">{activeIndex + 1}</span>
                <span className="text-gray-400">/</span>
                <span>{papers.length}</span>
                <span className="text-gray-400 ml-1">({progressPercent}%)</span>
                {pagination.total > papers.length && (
                  <>
                    <span className="text-gray-400 ml-1">of</span>
                    <span className="font-medium ml-1">{pagination.total}</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <DatePicker
                availableDates={availableDates}
                selectedDate={selectedDate}
                dateRange={dateRange}
                onDateSelect={handleDateSelect}
                onDateRangeSelect={handleDateRangeSelect}
              />

              <button
                onClick={() => setShowShortcuts(true)}
                className="flex items-center gap-2 px-3 py-2 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-lg text-xs hover:bg-gray-50 transition-colors shadow-sm"
                title="Keyboard shortcuts (Press ?)"
              >
                <Keyboard className="w-4 h-4 text-gray-600" />
                <span className="text-gray-700 font-medium">Shortcuts</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono text-gray-600">?</kbd>
              </button>
            </div>
          </div>
          
          <SearchBar
            onSearchChange={handleSearchChange}
            initialQuery={searchQuery}
            initialScope={searchScope}
          />
          
          <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-8 py-8">
        {papers.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            No papers found
          </div>
        ) : (
          <>
            <div>
              {papers.map((paper, index) => (
                <PaperCard 
                  key={paper.id} 
                  paper={paper}
                  isActive={index === activeIndex}
                  isExpanded={expandedIndices.has(index)}
                  onCardClick={() => handlePaperClick(index)}
                />
              ))}
            </div>

            {pagination.hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Loading...
                    </span>
                  ) : (
                    <span>Load More ({pagination.total - papers.length} remaining)</span>
                  )}
                </button>
                <div className="mt-2 text-xs text-gray-500">
                  or press <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">Shift+M</kbd>
                </div>
              </div>
            )}
          </>
        )}

        <footer className="mt-16 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
          Data from <a href="https://arxiv.org" className="text-indigo-600 hover:text-indigo-700 font-medium" target="_blank" rel="noopener noreferrer">arXiv.org</a>. Thank you to arXiv for use of its open access interoperability. Code open source at <a href="https://github.com/michaelnoi/alphascent" className="text-indigo-600 hover:text-indigo-700 font-medium" target="_blank" rel="noopener noreferrer">github.com/michaelnoi/alphascent</a>.
        </footer>
      </div>
    </div>
  );
}

