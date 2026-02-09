import type { ThreadItem } from '../types';

export const filterThreads = (threads: ThreadItem[], searchQuery: string) => {
  if (!searchQuery.trim()) {
    return threads;
  }
  const query = searchQuery.toLowerCase();
  return threads.filter(
    (thread) =>
      thread.title.toLowerCase().includes(query) ||
      thread.preview.toLowerCase().includes(query)
  );
};
