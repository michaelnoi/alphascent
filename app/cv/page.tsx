'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PapersData } from '@/app/lib/schema';
import { PaperCard } from '@/app/components/PaperCard';
import { Filters } from '@/app/components/Filters';
import { useKeyboardNav } from '@/app/components/useKeyboardNav';

export default function CVPage() {
  const [data, setData] = useState<PapersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const res = await fetch(`/data/papers-${dateStr}.json`);
        
        if (!res.ok) {
          throw new Error(`Failed to load papers: ${res.status}`);
        }
        
        const papersData: PapersData = await res.json();
        setData(papersData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load papers');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredPapers = useMemo(() => {
    if (!data) return [];
    if (!filterQuery.trim()) return data.papers;

    const query = filterQuery.toLowerCase();
    return data.papers.filter(paper => 
      paper.title.toLowerCase().includes(query) ||
      paper.abstract.toLowerCase().includes(query) ||
      paper.authors.some(author => author.toLowerCase().includes(query))
    );
  }, [data, filterQuery]);

  const activeIndex = useKeyboardNav(filteredPapers.length);

  const handleFilterChange = useCallback((query: string) => {
    setFilterQuery(query);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <div className="text-sm text-gray-500">Loading papers...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-base font-semibold text-gray-900 mb-2">Error loading papers</div>
          <div className="text-sm text-gray-600 mb-4">{error}</div>
          <div className="text-xs text-gray-500">
            Run: <code className="bg-indigo-50 px-2 py-1 rounded border border-indigo-200 font-mono">make scrape</code>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-400">No data available</div>
      </div>
    );
  }

  const progressPercent = filteredPapers.length > 0 ? Math.round(((activeIndex + 1) / filteredPapers.length) * 100) : 0;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 bg-[#fffaf3]/95 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  AlphaScent
                </h1>
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                  cs.CV papers · {data.date}
                </p>
              </div>
              
              <div className="flex items-center gap-1 text-xs text-gray-600 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2">
                <span className="font-medium">{activeIndex + 1}</span>
                <span className="text-gray-400">/</span>
                <span>{filteredPapers.length}</span>
                <span className="text-gray-400 ml-1">({progressPercent}%)</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-xs bg-white/70 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">⌘F</kbd>
                    <span className="text-gray-500 text-[10px]">search</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">↵</kbd>
                    <span className="text-gray-500 text-[10px]">exit search</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">j</kbd>
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">k</kbd>
                    <span className="text-gray-500 text-[10px]">navigate</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">␣</kbd>
                    <span className="text-gray-500 text-[10px]">expand</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">u</kbd>
                    <span className="text-gray-500 text-[10px]">abstract</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">i</kbd>
                    <span className="text-gray-500 text-[10px]">pdf</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">o</kbd>
                    <span className="text-gray-500 text-[10px]">code</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">p</kbd>
                    <span className="text-gray-500 text-[10px]">project</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-8 py-8">

        <Filters 
          onFilterChange={handleFilterChange}
          resultCount={filteredPapers.length}
          totalCount={data.papers.length}
        />

        {filteredPapers.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            No papers match your filter
          </div>
        ) : (
          <div>
            {filteredPapers.map((paper, index) => (
              <PaperCard 
                key={paper.id} 
                paper={paper}
                isActive={index === activeIndex}
              />
            ))}
          </div>
        )}

        <footer className="mt-16 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
          Data from <a href="https://arxiv.org" className="text-indigo-600 hover:text-indigo-700 font-medium" target="_blank" rel="noopener noreferrer">arXiv.org</a>
        </footer>
      </div>
    </div>
  );
}

