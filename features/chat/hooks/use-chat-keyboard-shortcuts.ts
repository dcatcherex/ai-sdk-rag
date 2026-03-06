import { useEffect } from 'react';

type ShortcutOptions = {
  onCreateThread: () => void;
};

export const useChatKeyboardShortcuts = ({
  onCreateThread,
}: ShortcutOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        onCreateThread();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreateThread]);
};
