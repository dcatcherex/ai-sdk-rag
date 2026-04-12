'use client';

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'chat-visible-agent-ids';

function readStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeStorage(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

/**
 * Manages which personal agents appear in the chat composer's agent picker.
 * State is persisted in localStorage so it survives page refreshes.
 */
export function useChatVisibleAgents() {
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    return readStorage();
  });

  const isVisible = useCallback((agentId: string) => visibleIds.has(agentId), [visibleIds]);

  const toggle = useCallback((agentId: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      writeStorage(next);
      return next;
    });
  }, []);

  return { visibleIds, isVisible, toggle };
}
