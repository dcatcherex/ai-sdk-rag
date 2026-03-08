'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpenIcon, LanguagesIcon, MessageSquarePlusIcon, SparklesIcon, WrapTextIcon } from 'lucide-react';

type SelectionMenuPosition = {
  anchorX: number; // centre of selection — where caret points
  anchorY: number;
  x: number;       // clamped left position of the menu box
  y: number;
  placement: 'top' | 'bottom';
  text: string;
};

type Action = {
  icon: React.ReactNode;
  label: string;
  buildPrompt: (text: string) => string;
};

const ACTIONS: Action[] = [
  {
    icon: <BookOpenIcon className="size-3" />,
    label: 'Explain more',
    buildPrompt: (text) => `Explain this in more detail:\n\n"${text}"`,
  },
  {
    icon: <LanguagesIcon className="size-3" />,
    label: 'Translate to Thai',
    buildPrompt: (text) => `Translate the following to Thai:\n\n"${text}"`,
  },
  {
    icon: <WrapTextIcon className="size-3" />,
    label: 'Summarize',
    buildPrompt: (text) => `Summarize this concisely:\n\n"${text}"`,
  },
  {
    icon: <SparklesIcon className="size-3" />,
    label: 'Improve writing',
    buildPrompt: (text) => `Improve the writing of this text:\n\n"${text}"`,
  },
  {
    icon: <MessageSquarePlusIcon className="size-3" />,
    label: 'Add to chat',
    buildPrompt: (text) => text,
  },
];

const MARGIN = 8; // px from viewport edge
const POINTER_OFFSET = 12;

const getSelectionAnchor = (range: Range) => {
  const boundingRect = range.getBoundingClientRect();
  if (!Number.isFinite(boundingRect.left) || !Number.isFinite(boundingRect.top)) {
    return null;
  }

  return {
    x: boundingRect.left,
    anchorX: boundingRect.left,
    anchorY: boundingRect.top,
  };
};

type SelectionContextMenuProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAction: (prompt: string) => void;
};

export const SelectionContextMenu = ({ containerRef, onAction }: SelectionContextMenuProps) => {
  const [menu, setMenu] = useState<SelectionMenuPosition | null>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const clearMenu = () => {
    setMenu(null);
    setVisible(false);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // After menu mounts, measure width and clamp x so it stays inside the viewport.
  // Run hidden first (opacity-0) then flip visible — no positional flash.
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) {
      setVisible(false);
      return;
    }

    if (!Number.isFinite(menu.anchorX) || !Number.isFinite(menu.anchorY)) {
      setMenu(null);
      setVisible(false);
      return;
    }

    const menuWidth = menuRef.current.offsetWidth;
    const menuHeight = menuRef.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const clampedX = Math.min(
      Math.max(menu.x, MARGIN),
      vw - menuWidth - MARGIN,
    );

    const topY = menu.anchorY - menuHeight - POINTER_OFFSET;
    const bottomY = menu.anchorY + POINTER_OFFSET;
    const fitsAbove = topY >= MARGIN;
    const nextPlacement = fitsAbove ? 'top' : 'bottom';
    const unclampedY = fitsAbove ? topY : bottomY;
    const clampedY = Math.min(
      Math.max(unclampedY, MARGIN),
      vh - menuHeight - MARGIN,
    );

    if (clampedX !== menu.x || clampedY !== menu.y || nextPlacement !== menu.placement) {
      setMenu((prev) => prev ? { ...prev, x: clampedX, y: clampedY, placement: nextPlacement } : prev);
      return;
    }

    setVisible(true);
  }, [menu]);

  useEffect(() => {
    const updateMenuFromSelection = () => {
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (!sel || !text || sel.isCollapsed || sel.rangeCount === 0) {
          clearMenu();
          return;
        }

        const range = sel.getRangeAt(0);
        if (!containerRef.current?.contains(range.commonAncestorContainer)) {
          clearMenu();
          return;
        }

        const anchor = getSelectionAnchor(range);
        if (!anchor) {
          clearMenu();
          return;
        }

        setVisible(false);
        setMenu({
          text,
          anchorX: anchor.anchorX,
          anchorY: anchor.anchorY,
          x: anchor.x,
          y: anchor.anchorY,
          placement: 'top',
        });
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      updateMenuFromSelection();
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      clearMenu();
    };

    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [containerRef]);

  if (!menu || !mounted) return null;

  // How far the caret anchor is from the left edge of the (clamped) menu box
  const caretOffset = Math.min(
    Math.max(menu.anchorX - menu.x, 16),
    (menuRef.current?.offsetWidth ?? 999) - 16,
  );
  const safeLeft = Number.isFinite(menu.x) ? menu.x : MARGIN;
  const safeTop = Number.isFinite(menu.y) ? menu.y : MARGIN;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: safeLeft,
        top: safeTop,
        zIndex: 60,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.1s',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 shadow-lg shadow-black/10 p-1">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 whitespace-nowrap transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              onAction(action.buildPrompt(menu.text));
              setMenu(null);
              setVisible(false);
              window.getSelection()?.removeAllRanges();
            }}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
      {/* Caret — tracks the actual selection centre even when box is shifted */}
      <div
        style={{ left: caretOffset }}
        className={`absolute -translate-x-1/2 size-0 border-x-4 border-x-transparent ${
          menu.placement === 'top'
            ? 'top-full border-t-4 border-t-white dark:border-t-zinc-800'
            : 'bottom-full border-b-4 border-b-white dark:border-b-zinc-800'
        }`}
      />
    </div>
    , document.body);
};
