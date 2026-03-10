'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useStickToBottomContext } from 'use-stick-to-bottom';

type ThreadScrollMemoryProps = {
  threadKey: string;
  threadId?: string;
  messagesLength: number;
  pendingRestoreThreadKeyRef: MutableRefObject<string | null>;
  scrollPositionsRef: MutableRefObject<Map<string, number>>;
};

export const ThreadScrollMemory = ({
  threadKey,
  threadId,
  messagesLength,
  pendingRestoreThreadKeyRef,
  scrollPositionsRef,
}: ThreadScrollMemoryProps) => {
  const { scrollRef, stopScroll } = useStickToBottomContext();
  const isRestoringRef = useRef(true);

  useLayoutEffect(() => {
    isRestoringRef.current = true;
    pendingRestoreThreadKeyRef.current = threadKey;
    stopScroll();
  }, [pendingRestoreThreadKeyRef, stopScroll, threadKey]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const saveScrollPosition = () => {
      if (isRestoringRef.current) return;
      scrollPositionsRef.current.set(threadKey, scrollElement.scrollTop);
    };

    scrollElement.addEventListener('scroll', saveScrollPosition, { passive: true });
    return () => {
      saveScrollPosition();
      scrollElement.removeEventListener('scroll', saveScrollPosition);
    };
  }, [scrollPositionsRef, scrollRef, threadKey]);

  useLayoutEffect(() => {
    if (pendingRestoreThreadKeyRef.current !== threadKey) return;
    if (threadId && messagesLength === 0) return;

    const frameId = window.requestAnimationFrame(() => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) return;

      const savedPosition = scrollPositionsRef.current.get(threadKey);

      if (typeof savedPosition === 'number') {
        scrollElement.scrollTop = savedPosition;
      } else if (threadId && messagesLength > 0) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      } else {
        scrollElement.scrollTop = 0;
      }

      scrollPositionsRef.current.set(threadKey, scrollElement.scrollTop);
      isRestoringRef.current = false;
      pendingRestoreThreadKeyRef.current = null;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [messagesLength, pendingRestoreThreadKeyRef, scrollPositionsRef, scrollRef, threadId, threadKey]);

  return null;
};
