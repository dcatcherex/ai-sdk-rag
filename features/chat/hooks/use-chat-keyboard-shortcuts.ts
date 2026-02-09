import { useEffect } from 'react';

type ShortcutOptions = {
  onCreateThread: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
};

export const useChatKeyboardShortcuts = ({
  onCreateThread,
  searchQuery,
  setSearchQuery,
}: ShortcutOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        onCreateThread();
      }

      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        document.getElementById('thread-search')?.focus();
      }

      if (event.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreateThread, searchQuery, setSearchQuery]);
};
