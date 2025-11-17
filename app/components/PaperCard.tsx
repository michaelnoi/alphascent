'use client';

import { useState, useRef, useEffect } from 'react';
import { FileText, File, Code2, Globe } from 'lucide-react';
import Image from 'next/image';

export interface PaperFromAPI {
  id: string;
  title: string;
  authors: string[];
  categories: string[];
  primary_category: string | null;
  abstract: string | null;
  submitted_date: string;
  announce_date: string | null;
  scraped_date: string;
  pdf_url: string | null;
  code_url: string | null;
  project_url: string | null;
  comments: string | null;
  figures: Array<{
    kind: string;
    url: string;
    thumb: string | null;
    width: number | null;
    height: number | null;
  }>;
}

interface PaperCardProps {
  paper: PaperFromAPI;
  isActive?: boolean;
  onCardClick?: () => void;
}

export function PaperCard({ paper, isActive = false, onCardClick }: PaperCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ 
        behavior: 'instant', 
        block: 'center'
      });
    }
  }, [isActive, isExpanded]);

  const handleClick = () => {
    setIsExpanded(!isExpanded);
    onCardClick?.();
  };

  const openLink = (url: string, stayOnPage: boolean) => {
    if (stayOnPage) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    } else if (e.key.toLowerCase() === 'u' && paper.pdf_url) {
      e.preventDefault();
      openLink(paper.pdf_url.replace('/pdf/', '/abs/'), e.shiftKey);
    } else if (e.key.toLowerCase() === 'i' && paper.pdf_url) {
      e.preventDefault();
      openLink(paper.pdf_url, e.shiftKey);
    } else if (e.key.toLowerCase() === 'o' && paper.code_url) {
      e.preventDefault();
      openLink(paper.code_url, e.shiftKey);
    } else if (e.key.toLowerCase() === 'p' && paper.project_url) {
      e.preventDefault();
      openLink(paper.project_url, e.shiftKey);
    }
  };

  const displayAuthors = paper.authors.slice(0, 3);
  const remainingAuthors = paper.authors.length - 3;

  const abstractPreview = paper.abstract?.split('.')[0] + '.' || '';
  const firstFigure = paper.figures.length > 0 ? paper.figures[0] : null;
  const secondFigure = paper.figures.length > 1 ? paper.figures[1] : null;
  const absUrl = paper.pdf_url?.replace('/pdf/', '/abs/') || '';

  if (isExpanded) {
    return (
      <div
        ref={cardRef}
        className={`
          border rounded-xl mb-3 cursor-pointer transition-all duration-200 shadow-sm
          hover:shadow-md overflow-hidden scroll-mt-20
          ${isActive ? 'ring-4 ring-indigo-500 border-indigo-400 shadow-xl bg-orange-50/60 scale-[1.04]' : 'border-gray-200'}
        `}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={true}
      >
        <div className="p-6 h-[75vh] flex flex-col overflow-hidden bg-orange-50/40">
          <div className="flex gap-6 flex-shrink-0 mb-4 pb-4 border-b border-indigo-100/30">
            <div className="w-48 h-36 bg-gradient-to-br from-indigo-50 via-white to-violet-50 border border-indigo-100/50 rounded-xl flex-shrink-0 flex items-center justify-center shadow-inner overflow-hidden">
              {firstFigure?.thumb ? (
                <Image 
                  src={firstFigure.thumb} 
                  alt="First figure preview"
                  width={200}
                  height={150}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <svg className="w-8 h-8 text-indigo-300/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-2xl mb-3 leading-tight text-gray-900 break-words">
                <a
                  href={absUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {paper.title}
                </a>
              </h3>
              
              <div className="text-sm text-gray-600 mb-3 break-words">
                {paper.authors.join(', ')}
              </div>

              <div className="flex flex-shrink-0 gap-0">
                {absUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(absUrl, '_blank');
                    }}
                    className="rounded-l-md border border-gray-200 px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none inline-flex items-center gap-3 text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Abstract</span>
                  </button>
                )}
                {paper.pdf_url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(paper.pdf_url!, '_blank');
                    }}
                    className={`-ml-px border border-gray-200 px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none inline-flex items-center gap-3 text-sm ${!paper.code_url && !paper.project_url ? 'rounded-r-md' : ''}`}
                  >
                    <File className="w-4 h-4" />
                    <span>PDF</span>
                  </button>
                )}
                {paper.code_url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(paper.code_url!, '_blank');
                    }}
                    className={`-ml-px border border-gray-200 px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none inline-flex items-center gap-3 text-sm ${!paper.project_url ? 'rounded-r-md' : ''}`}
                  >
                    <Code2 className="w-4 h-4" />
                    <span>Code</span>
                  </button>
                )}
                {paper.project_url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(paper.project_url!, '_blank');
                    }}
                    className="-ml-px rounded-r-md border border-gray-200 px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none inline-flex items-center gap-3 text-sm"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Project</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 mb-4 overflow-x-hidden">
            <p className="text-[15px] text-gray-700 leading-relaxed mb-5 font-serif-abstract break-words">
              {paper.abstract}
            </p>

            {(firstFigure || secondFigure) && (
              <div className="mb-5">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Figures</h4>
                <div className={`grid gap-4 ${firstFigure && secondFigure ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {firstFigure && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                      <Image 
                        src={firstFigure.url} 
                        alt="First figure"
                        width={800}
                        height={600}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600 border-t font-medium">
                        First figure
                      </div>
                    </div>
                  )}
                  {secondFigure && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                      <Image 
                        src={secondFigure.url} 
                        alt="Second figure"
                        width={800}
                        height={600}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600 border-t font-medium">
                        Second figure
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {paper.comments && (
              <div className="text-sm text-gray-600 italic bg-amber-50/50 border border-amber-100/50 rounded-xl p-3.5 shadow-sm break-words">
                {paper.comments}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`
        border bg-white rounded-xl p-4 mb-3 cursor-pointer transition-all duration-200 shadow-sm
        hover:shadow-md hover:border-gray-300 overflow-hidden scroll-mt-20
        ${isActive ? 'ring-4 ring-indigo-500 border-indigo-400 shadow-xl bg-indigo-50/30 scale-110' : 'border-gray-200'}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-expanded={false}
    >
      <div className="flex gap-4">
        <div className="w-20 h-16 bg-gradient-to-br from-indigo-50 via-white to-violet-50 border border-indigo-100/50 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden">
          {firstFigure?.thumb ? (
            <Image 
              src={firstFigure.thumb} 
              alt="First figure preview"
              width={200}
              height={150}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <svg className="w-5 h-5 text-indigo-300/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg leading-snug mb-2 text-gray-900">
            <a
              href={absUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {paper.title}
            </a>
          </h3>

          <div className="text-sm text-gray-600 mb-2">
            {displayAuthors.join(', ')}
            {remainingAuthors > 0 && (
              <span className="text-gray-400"> + {remainingAuthors} more</span>
            )}
          </div>

          <p className="text-[13px] text-gray-600 line-clamp-2 leading-relaxed font-serif-abstract">
            {abstractPreview}
          </p>
        </div>
      </div>
    </div>
  );
}
