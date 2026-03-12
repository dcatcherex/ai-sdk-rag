"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ThreadItem } from "../types";
import { SidebarContent } from "./sidebar/sidebar-content";
import {
  DEFAULT_VISIBLE_SIDEBAR_ITEM_IDS,
  type SidebarNavItemId,
} from "./sidebar/sidebar-nav";
import type { SessionData, UserProfileData } from "./sidebar/types";
import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_VISIBLE_ITEMS_STORAGE_KEY,
} from "./sidebar/types";

// Module-level cache — survives component remounts on navigation.
// Initialized lazily on first client render from localStorage.
let collapsedCache: boolean | null = null;
let visibleItemsCache: SidebarNavItemId[] | null = null;

function readCollapsed(): boolean {
  if (collapsedCache !== null) return collapsedCache;
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
  collapsedCache = stored !== null ? stored === "true" : true;
  return collapsedCache;
}

function readVisibleItems(): SidebarNavItemId[] {
  if (visibleItemsCache !== null) return visibleItemsCache;
  if (typeof window === "undefined") return DEFAULT_VISIBLE_SIDEBAR_ITEM_IDS;

  try {
    const stored = window.localStorage.getItem(SIDEBAR_VISIBLE_ITEMS_STORAGE_KEY);
    if (!stored) {
      visibleItemsCache = DEFAULT_VISIBLE_SIDEBAR_ITEM_IDS;
      return visibleItemsCache;
    }

    const parsed = JSON.parse(stored) as SidebarNavItemId[];
    const next = DEFAULT_VISIBLE_SIDEBAR_ITEM_IDS.filter((itemId) =>
      parsed.includes(itemId),
    );

    visibleItemsCache = next.length > 0 ? next : DEFAULT_VISIBLE_SIDEBAR_ITEM_IDS;
    return visibleItemsCache;
  } catch {
    visibleItemsCache = DEFAULT_VISIBLE_SIDEBAR_ITEM_IDS;
    return visibleItemsCache;
  }
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
  // Reads from module cache — no effect needed, no flash on remount
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [visibleItemIds, setVisibleItemIds] = useState(readVisibleItems);
  const effectiveCollapsed = forceCollapsed || isCollapsed;

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      collapsedCache = next;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  };

  const handleSelectThread = (threadId: string) => {
    onSelectThread(threadId);
    onMobileOpenChange?.(false);
  };

  const handleToggleItemVisibility = (
    itemId: SidebarNavItemId,
    checked: boolean,
  ) => {
    setVisibleItemIds((prev) => {
      const next = checked
        ? prev.includes(itemId)
          ? prev
          : DEFAULT_VISIBLE_SIDEBAR_ITEM_IDS.filter(
              (defaultItemId) =>
                defaultItemId === itemId || prev.includes(defaultItemId),
            )
        : prev.filter((id) => id !== itemId);

      visibleItemsCache = next;
      window.localStorage.setItem(
        SIDEBAR_VISIBLE_ITEMS_STORAGE_KEY,
        JSON.stringify(next),
      );
      return next;
    });
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
    visibleItemIds,
    onToggleItemVisibility: handleToggleItemVisibility,
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden h-[calc(100vh-3rem)] shrink-0 rounded-3xl border border-black/5 dark:border-border bg-background dark:bg-sidebar/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] dark:shadow-[0_20px_60px_-40px_rgba(0,0,0,0.6)] backdrop-blur transition-all md:flex md:flex-col",
          effectiveCollapsed ? "w-20 p-3" : "w-72 p-5 ", 
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
