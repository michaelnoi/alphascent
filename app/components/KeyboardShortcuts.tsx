'use client';

import { useState, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['j'], description: 'Navigate to next paper' },
        { keys: ['k'], description: 'Navigate to previous paper' },
        { keys: ['↓'], description: 'Navigate to next paper' },
        { keys: ['↑'], description: 'Navigate to previous paper' },
        { keys: ['Space'], description: 'Expand/collapse paper details' },
      ],
    },
    {
      category: 'Search',
      items: [
        { keys: ['⌘', 'F'], description: 'Focus search bar' },
        { keys: ['Enter'], description: 'Execute search (disables text input)' },
        { keys: ['Esc'], description: 'Blur search bar' },
      ],
    },
    {
      category: 'Open Links',
      items: [
        { keys: ['u'], description: 'Open abstract page' },
        { keys: ['i'], description: 'Open PDF' },
        { keys: ['o'], description: 'Open code repository (if available)' },
        { keys: ['p'], description: 'Open project page (if available)' },
        { keys: ['⇧', 'u/i/o/p'], description: 'Open in new tab (otherwise navigates in same tab)' },
      ],
    },
    {
      category: 'Content',
      items: [
        { keys: ['⇧', 'M'], description: 'Load more papers' },
      ],
    },
    {
      category: 'Help',
      items: [
        { keys: ['?'], description: 'Show/hide keyboard shortcuts' },
        { keys: ['Esc'], description: 'Close this dialog' },
      ],
    },
  ];

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Keyboard className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="overflow-y-auto p-6">
            <div className="space-y-6">
              {shortcuts.map((category, idx) => (
                <div key={idx}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    {category.category}
                  </h3>
                  <div className="space-y-2">
                    {category.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-sm text-gray-600">{item.description}</span>
                        <div className="flex items-center gap-1.5">
                          {item.keys.map((key, keyIdx) => (
                            <kbd
                              key={keyIdx}
                              className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-mono font-medium text-gray-700 min-w-[2rem] text-center"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              Press <kbd className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

