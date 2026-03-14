"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ThreadItem } from "../types";
import { SidebarContent } from "./sidebar/sidebar-content";
import { DEFAULT_PINNED_IDS, NAV_REGISTRY, type NavItemId } from "./sidebar/sidebar-nav";
import type { SessionData, UserProfileData } from "./sidebar/types";
import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_PINNED_ITEMS_STORAGE_KEY,
  SIDEBAR_VISIBLE_ITEMS_STORAGE_KEY,
  SIDEBAR_ITEM_ORDER_STORAGE_KEY,
} from "./sidebar/types";

// Module-level cache — survives component remounts on navigation.
let collapsedCache: boolean | null = null;
let pinnedItemsCache: NavItemId[] | null = null;

function readCollapsed(): boolean {
  if (collapsedCache !== null) return collapsedCache;
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
  collapsedCache = stored !== null ? stored === "true" : true;
  return collapsedCache;
}

function readPinnedItems(): NavItemId[] {
  if (pinnedItemsCache !== null) return pinnedItemsCache;
  if (typeof window === "undefined") return DEFAULT_PINNED_IDS;

  const validIds = NAV_REGISTRY.map((item) => item.id);

  // Try new key first
  try {
    const stored = window.localStorage.getItem(SIDEBAR_PINNED_ITEMS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as NavItemId[];
      const valid = parsed.filter((id): id is NavItemId => validIds.includes(id));
      if (valid.length > 0) {
        pinnedItemsCache = valid;
        return pinnedItemsCache;
      }
    }
  } catch {
    // fall through to migration
  }

  // Migrate from legacy keys
  try {
    const oldVisible = window.localStorage.getItem(SIDEBAR_VISIBLE_ITEMS_STORAGE_KEY);
    const oldOrder = window.localStorage.getItem(SIDEBAR_ITEM_ORDER_STORAGE_KEY);
    if (oldVisible) {
      const visible = JSON.parse(oldVisible) as NavItemId[];
      const ordered = oldOrder ? (JSON.parse(oldOrder) as NavItemId[]) : visible;
      const merged = ordered.filter(
        (id): id is NavItemId => validIds.includes(id) && visible.includes(id),
      );
      if (merged.length > 0) {
        pinnedItemsCache = merged;
        window.localStorage.setItem(SIDEBAR_PINNED_ITEMS_STORAGE_KEY, JSON.stringify(merged));
        window.localStorage.removeItem(SIDEBAR_VISIBLE_ITEMS_STORAGE_KEY);
        window.localStorage.removeItem(SIDEBAR_ITEM_ORDER_STORAGE_KEY);
        return pinnedItemsCache;
      }
    }
  } catch {
    // fall through
  }

  pinnedItemsCache = DEFAULT_PINNED_IDS;
  return pinnedItemsCache;
}

export type ChatSidebarProps = {
  activeThreadId: string;
  threads: ThreadItem[];
  isLoading: boolean;
  isCreatingThread: boolean;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onTogglePin: (threadId: string, pinned: boolean) => void;
  onRenameThread: (threadId: string, title: string) => void;
  onDeleteThread: (threadId: string) => void;
  sessionData: SessionData;
  userProfile: UserProfileData;
  isSigningOut: boolean;
  onSignOut: () => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  forceCollapsed?: boolean;
};

export const ChatSidebar = ({
  activeThreadId,
  threads,
  isLoading,
  isCreatingThread,
  onSelectThread,
  onCreateThread,
  onTogglePin,
  onRenameThread,
  onDeleteThread,
  sessionData,
  userProfile,
  isSigningOut,
  onSignOut,
  mobileOpen = false,
  onMobileOpenChange,
  forceCollapsed = false,
}: ChatSidebarProps) => {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [pinnedItemIds, setPinnedItemIds] = useState(readPinnedItems);
  const effectiveCollapsed = forceCollapsed || isCollapsed;

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      collapsedCache = next;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  };

  const handleToggleNavPin = (itemId: NavItemId) => {
    setPinnedItemIds((prev) => {
      const next = prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)      // unpin
        : [...prev, itemId];                       // pin at end
      pinnedItemsCache = next;
      window.localStorage.setItem(SIDEBAR_PINNED_ITEMS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleReorderPinned = (nextPinnedItemIds: NavItemId[]) => {
    pinnedItemsCache = nextPinnedItemIds;
    setPinnedItemIds(nextPinnedItemIds);
    window.localStorage.setItem(SIDEBAR_PINNED_ITEMS_STORAGE_KEY, JSON.stringify(nextPinnedItemIds));
  };

  const handleSelectThread = (threadId: string) => {
    onSelectThread(threadId);
    onMobileOpenChange?.(false);
  };

  const sharedProps = {
    activeThreadId,
    threads,
    isLoading,
    isCreatingThread,
    onCreateThread,
    onSelectThread: handleSelectThread,
    onTogglePin,
    onRenameThread,
    onDeleteThread,
    sessionData,
    userProfile,
    isSigningOut,
    onSignOut,
    currentPath: pathname,
    pinnedItemIds,
    onToggleNavPin: handleToggleNavPin,
    onReorderPinned: handleReorderPinned,
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden h-[calc(100vh-3rem)] shrink-0 rounded-3xl border border-black/5 dark:border-border bg-background dark:bg-sidebar/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] dark:shadow-[0_20px_60px_-40px_rgba(0,0,0,0.6)] backdrop-blur transition-all md:flex md:flex-col",
          effectiveCollapsed ? "w-20 p-3" : "w-72 p-5",
        )}
      >
        <SidebarContent
          {...sharedProps}
          isCollapsed={effectiveCollapsed}
          onToggleCollapse={forceCollapsed ? undefined : handleToggleCollapse}
        />
      </aside>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[85vw] max-w-xs p-5 sm:max-w-xs">
          <SheetTitle className="sr-only">Thread list</SheetTitle>
          <SidebarContent {...sharedProps} />
        </SheetContent>
      </Sheet>
    </>
  );
};
