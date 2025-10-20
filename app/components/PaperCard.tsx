'use client';

import { Paper } from '@/app/lib/schema';
import { useState, useRef, useEffect } from 'react';
import { FileText, File, Code2, Globe } from 'lucide-react';
import Image from 'next/image';

interface PaperCardProps {
  paper: Paper;
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
    } else if (e.key.toLowerCase() === 'u') {
      e.preventDefault();
      openLink(paper.links.abs, e.shiftKey);
    } else if (e.key.toLowerCase() === 'i') {
      e.preventDefault();
      openLink(paper.links.pdf, e.shiftKey);
    } else if (e.key.toLowerCase() === 'o' && paper.links.code) {
      e.preventDefault();
      openLink(paper.links.code, e.shiftKey);
    } else if (e.key.toLowerCase() === 'p' && paper.links.project_page) {
      e.preventDefault();
      openLink(paper.links.project_page, e.shiftKey);
    }
  };

  const displayAuthors = paper.authors.slice(0, 3);
  const remainingAuthors = paper.authors.length - 3;

  const abstractPreview = paper.abstract.split('.')[0] + '.';

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
              {paper.links.figures?.teaser ? (
                <Image 
                  src={paper.links.figures.teaser.thumb} 
                  alt="Teaser preview"
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
                  href={paper.links.abs}
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

              <div className="flex flex-wrap items-center mb-3">
                <div className="flex flex-wrap gap-1.5 flex-shrink-0 mr-6">
                {paper.categories.map((cat, idx) => (
                  <span
                    key={idx}
                    className={`
                      text-xs px-2.5 py-1 rounded-md font-medium
                      ${cat === paper.primary_category 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'bg-gray-100 text-gray-600'
                      }
                    `}
                  >
                    {cat}
                  </span>
                ))}
                </div>
                
                <div className="flex flex-shrink-0 gap-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(paper.links.abs, '_blank');
                    }}
                    className="rounded-l-md border border-gray-200 px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none inline-flex items-center gap-3 text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Abstract</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(paper.links.pdf, '_blank');
                    }}
                    className={`-ml-px border border-gray-200 px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none inline-flex items-center gap-3 text-sm ${!paper.links.code && !paper.links.project_page ? 'rounded-r-md' : ''}`}
                  >
                    <File className="w-4 h-4" />
                    <span>PDF</span>
                  </button>
                  {paper.links.code && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(paper.links.code, '_blank');
                      }}
                      className={`-ml-px border border-gray-200 px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none inline-flex items-center gap-3 text-sm ${!paper.links.project_page ? 'rounded-r-md' : ''}`}
                    >
                      <Code2 className="w-4 h-4" />
                      <span>Code</span>
                    </button>
                  )}
                  {paper.links.project_page && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(paper.links.project_page, '_blank');
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
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 mb-4 overflow-x-hidden">
            {(paper.links.figures?.teaser || paper.links.figures?.architecture) && (
              <div className="mb-5">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Figures</h4>
                <div className={`grid gap-4 ${paper.links.figures.teaser && paper.links.figures.architecture ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {paper.links.figures.teaser && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                      <Image 
                        src={paper.links.figures.teaser.full} 
                        alt="Method teaser"
                        width={800}
                        height={600}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600 border-t font-medium">
                        Teaser
                      </div>
                    </div>
                  )}
                  {paper.links.figures.architecture && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                      <Image 
                        src={paper.links.figures.architecture.full} 
                        alt="Architecture diagram"
                        width={800}
                        height={600}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600 border-t font-medium">
                        Architecture
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <p className="text-[15px] text-gray-700 leading-relaxed mb-4 font-serif-abstract break-words">
              {paper.abstract}
            </p>

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
          {paper.links.figures?.teaser ? (
            <Image 
              src={paper.links.figures.teaser.thumb} 
              alt="Teaser preview"
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
              href={paper.links.abs}
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

          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {paper.categories.slice(0, 4).map((cat, idx) => (
              <span
                key={idx}
                className={`
                  text-xs px-2.5 py-0.5 rounded-md font-medium
                  ${cat === paper.primary_category 
                    ? 'bg-indigo-100 text-indigo-700' 
                    : 'bg-gray-100 text-gray-600'
                  }
                `}
              >
                {cat}
              </span>
            ))}
          </div>

          <p className="text-[13px] text-gray-600 line-clamp-2 leading-relaxed font-serif-abstract">
            {abstractPreview}
          </p>
        </div>
      </div>
    </div>
  );
}

