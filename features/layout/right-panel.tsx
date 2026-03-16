'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into the layout's right-panel slot via a portal.
 * Use this in any page that needs a right panel — it auto-shows/hides
 * the slot and cleans up when the page unmounts.
 */
export function RightPanel({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById('right-panel-slot'));
  }, []);

  if (!container) return null;
  return createPortal(children, container);
}
