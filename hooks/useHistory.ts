
import { useState, useCallback } from 'react';

export function useHistory<T>(initialState: T | null) {
  const [history, setHistory] = useState<T[]>(initialState ? [initialState] : []);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Initialize history when data is loaded for the first time
  const init = useCallback((state: T) => {
    setHistory([state]);
    setCurrentIndex(0);
  }, []);

  const state = history[currentIndex] || null;

  const set = useCallback((newState: T) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      return [...newHistory, newState];
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex]);

  const undo = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const redo = useCallback(() => {
    setCurrentIndex(prev => Math.min(history.length - 1, prev + 1));
  }, [history.length]);

  return {
    state,
    set,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    init
  };
}
