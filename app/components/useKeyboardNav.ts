'use client';

import { useEffect, useState } from 'react';

export function useKeyboardNav(totalCards: number) {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(prev => {
            const next = Math.min(prev + 1, totalCards - 1);
            scrollToCard(next);
            return next;
          });
          break;
        
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(prev => {
            const next = Math.max(prev - 1, 0);
            scrollToCard(next);
            return next;
          });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalCards]);

  return { activeIndex, setActiveIndex };
}

function scrollToCard(index: number) {
  setTimeout(() => {
    const cards = document.querySelectorAll('[role="button"][aria-expanded]');
    const card = cards[index] as HTMLElement;
    if (card) {
      card.focus();
    }
  }, 0);
}

