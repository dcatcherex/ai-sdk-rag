'use client';

import { useCallback, useState } from 'react';

/** Personal agents: opt-in — must be activated to appear in picker. */
const VISIBLE_KEY = 'chat-visible-agent-ids';

/** Essentials: opt-out — shown by default, stored IDs are the hidden ones. */
const HIDDEN_ESSENTIALS_KEY = 'chat-hidden-essential-ids';

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, ids: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

/**
 * Manages which agents appear in the chat composer's agent picker.
 *
 * Personal agents  — opt-in:  grey by default, green = shown in picker.
 * Essential agents — opt-out: green by default, grey = hidden from picker.
 */
export function useChatVisibleAgents() {
  const [visiblePersonal, setVisiblePersonal] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    return readSet(VISIBLE_KEY);
  });

  const [hiddenEssentials, setHiddenEssentials] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    return readSet(HIDDEN_ESSENTIALS_KEY);
  });

  /** Is a personal (Mine) agent shown in the picker? */
  const isPersonalVisible = useCallback(
    (id: string) => visiblePersonal.has(id),
    [visiblePersonal],
  );

  /** Is an Essential agent shown in the picker? (default: true) */
  const isEssentialVisible = useCallback(
    (id: string) => !hiddenEssentials.has(id),
    [hiddenEssentials],
  );

  /** Toggle a personal agent on/off in the picker. */
  const togglePersonal = useCallback((id: string) => {
    setVisiblePersonal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      writeSet(VISIBLE_KEY, next);
      return next;
    });
  }, []);

  /** Toggle an Essential on/off in the picker. */
  const toggleEssential = useCallback((id: string) => {
    setHiddenEssentials((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      writeSet(HIDDEN_ESSENTIALS_KEY, next);
      return next;
    });
  }, []);

  /**
   * Force-activate a personal agent (call after create or clone so the
   * new agent appears in the picker immediately with a green dot).
   */
  const activatePersonal = useCallback((id: string) => {
    setVisiblePersonal((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeSet(VISIBLE_KEY, next);
      return next;
    });
  }, []);

  return {
    isPersonalVisible,
    isEssentialVisible,
    togglePersonal,
    toggleEssential,
    activatePersonal,
  };
}
