import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';

interface TVNavigationContextType {
  focusedId: string | null;
  setFocusedId: (id: string | null, options?: { preventScroll?: boolean }) => void;
  register: (id: string, element: HTMLElement) => void;
  unregister: (id: string) => void;
}

const TVNavigationContext = createContext<TVNavigationContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useTVNavigation = () => {
  const context = useContext(TVNavigationContext);
  if (!context) {
    throw new Error('useTVNavigation must be used within a TVNavigationProvider');
  }
  return context;
};

interface TVNavigationProviderProps {
  children: React.ReactNode;
}

export const TVNavigationProvider: React.FC<TVNavigationProviderProps> = ({ children }) => {
  const [focusedId, setFocusedIdState] = useState<string | null>(null);
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const shouldScrollRef = useRef(true);

  const setFocusedId = useCallback((id: string | null, options?: { preventScroll?: boolean }) => {
    shouldScrollRef.current = !options?.preventScroll;
    setFocusedIdState(id);
  }, []);
  
  // Register focusable elements
  const register = useCallback((id: string, element: HTMLElement) => {
    elementsRef.current.set(id, element);
    // Auto-focus first element if nothing is focused
    if (!focusedId && elementsRef.current.size === 1) {
      setFocusedId(id);
    }
  }, [focusedId, setFocusedId]);

  const unregister = useCallback((id: string) => {
    elementsRef.current.delete(id);
    if (focusedId === id) {
      // If the focused element is removed, reset focus (could be smarter here)
      setFocusedId(null);
    }
  }, [focusedId, setFocusedId]);

  // Find the next element in the given direction
  const findNextFocus = useCallback((currentId: string, direction: Direction): string | null => {
    const currentEl = elementsRef.current.get(currentId);
    if (!currentEl) return null;

    const currentRect = currentEl.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2,
    };

    let bestCandidate: string | null = null;
    let minDistance = Infinity;

    elementsRef.current.forEach((el, id) => {
      if (id === currentId) return;

      const rect = el.getBoundingClientRect();
      
      // Skip off-screen or hidden elements (simplified check)
      if (rect.width === 0 || rect.height === 0) return;

      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      // Directional filtering
      let isValid = false;
      // angleThreshold removed as it was unused

      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;
      
      // Check if the element is strictly in the direction
      switch (direction) {
        case 'up':
          isValid = dy < 0 && Math.abs(dx) < Math.abs(dy) * 2; // Allow some horizontal drift
          break;
        case 'down':
          isValid = dy > 0 && Math.abs(dx) < Math.abs(dy) * 2;
          break;
        case 'left':
          isValid = dx < 0 && Math.abs(dy) < Math.abs(dx) * 2;
          break;
        case 'right':
          isValid = dx > 0 && Math.abs(dy) < Math.abs(dx) * 2;
          break;
      }

      if (isValid) {
        // Calculate Euclidean distance
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Weight distance to favor aligned elements
        let weightedDistance = distance;
        if ((direction === 'left' || direction === 'right') && Math.abs(dy) < 10) {
            weightedDistance *= 0.5; // Favor same row
        }
        if ((direction === 'up' || direction === 'down') && Math.abs(dx) < 10) {
            weightedDistance *= 0.5; // Favor same column
        }

        if (weightedDistance < minDistance) {
          minDistance = weightedDistance;
          bestCandidate = id;
        }
      }
    });

    return bestCandidate;
  }, []);

  // Handle global key events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedId && elementsRef.current.size > 0) {
        // Recover focus if lost
        const first = elementsRef.current.keys().next().value;
        if (first) setFocusedId(first);
        return;
      }

      if (!focusedId) return;

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          const nextUp = findNextFocus(focusedId, 'up');
          if (nextUp) setFocusedId(nextUp);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const nextDown = findNextFocus(focusedId, 'down');
          if (nextDown) setFocusedId(nextDown);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const nextLeft = findNextFocus(focusedId, 'left');
          if (nextLeft) setFocusedId(nextLeft);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const nextRight = findNextFocus(focusedId, 'right');
          if (nextRight) setFocusedId(nextRight);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const el = elementsRef.current.get(focusedId);
          if (el) el.click();
          break;
        }
        case 'Escape':
        case 'Backspace':
           // Optional: Handle back navigation
           window.history.back();
           break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedId, findNextFocus]);

  // Scroll focused element into view
  useEffect(() => {
    if (focusedId && shouldScrollRef.current) {
      const el = elementsRef.current.get(focusedId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  }, [focusedId]);

  return (
    <TVNavigationContext.Provider value={{ focusedId, setFocusedId, register, unregister }}>
      {children}
    </TVNavigationContext.Provider>
  );
};
