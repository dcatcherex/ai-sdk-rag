'use client';

import { useMemo } from 'react';
import { PinIcon, PinOffIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';

import { formatRelativeTime } from '../utils/format-relative-time';
import { filterThreads } from '../utils/filter-threads';
import type { ThreadItem } from '../types';

type ChatSidebarProps = {
  activeThreadId: string;
  threads: ThreadItem[];
  isLoading: boolean;
  isCreatingThread: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onTogglePin: (threadId: string, pinned: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
};

const ThreadRow = ({
  thread,
  isActive,
  onSelect,
  onTogglePin,
}: {
  thread: ThreadItem;
  isActive: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}) => (
  <div
    className={`group flex w-full items-center rounded-lg text-sm transition ${
      isActive
        ? 'bg-muted font-medium text-foreground'
        : 'text-foreground/80 hover:bg-muted/50'
    }`}
  >
    <button
      className="min-w-0 flex-1 truncate px-3 py-2 text-left"
      onClick={onSelect}
      type="button"
    >
      {thread.title}
    </button>
    <button
      type="button"
      className="mr-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
      onClick={(e) => {
        e.stopPropagation();
        onTogglePin();
      }}
      title={thread.pinned ? 'Unpin' : 'Pin'}
    >
      {thread.pinned ? (
        <PinOffIcon className="size-3.5" />
      ) : (
        <PinIcon className="size-3.5" />
      )}
    </button>
  </div>
);

const SidebarContent = ({
  activeThreadId,
  filteredThreads,
  isLoading,
  isCreatingThread,
  searchQuery,
  onSearchChange,
  onCreateThread,
  onSelectThread,
  onTogglePin,
}: {
  activeThreadId: string;
  filteredThreads: ThreadItem[];
  isLoading: boolean;
  isCreatingThread: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCreateThread: () => void;
  onSelectThread: (threadId: string) => void;
  onTogglePin: (threadId: string, pinned: boolean) => void;
}) => {
  const pinnedThreads = filteredThreads.filter((t) => t.pinned);
  const recentThreads = filteredThreads.filter((t) => !t.pinned);

  return (
    <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Workspace
        </p>
        <h1 className="text-lg font-semibold text-foreground">Studio Chat</h1>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-4 w-full justify-start gap-2"
        onClick={onCreateThread}
        disabled={isCreatingThread}
      >
        <PlusIcon className="size-4" />
        New chat
      </Button>

      <div className="relative mt-3">
        <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          id="thread-search"
          type="text"
          placeholder="Search threads... (⌘/)"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9 pr-3 text-sm"
        />
      </div>

      <div className="-mx-2 mt-4 flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="px-3 text-xs text-muted-foreground">Loading threads…</p>
        ) : filteredThreads.length === 0 ? (
          <p className="px-3 text-xs text-muted-foreground">
            {searchQuery ? 'No threads found.' : 'No threads yet. Start a new chat.'}
          </p>
        ) : (
          <>
            {pinnedThreads.length > 0 && (
              <div className="mb-2">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pinned
                </p>
                {pinnedThreads.map((thread) => (
                  <ThreadRow
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === activeThreadId}
                    onSelect={() => onSelectThread(thread.id)}
                    onTogglePin={() => onTogglePin(thread.id, !thread.pinned)}
                  />
                ))}
              </div>
            )}
            {recentThreads.length > 0 && (
              <div>
                {pinnedThreads.length > 0 && (
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recents
                  </p>
                )}
                {recentThreads.map((thread) => (
                  <ThreadRow
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === activeThreadId}
                    onSelect={() => onSelectThread(thread.id)}
                    onTogglePin={() => onTogglePin(thread.id, !thread.pinned)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export const ChatSidebar = ({
  activeThreadId,
  threads,
  isLoading,
  isCreatingThread,
  searchQuery,
  onSearchChange,
  onSelectThread,
  onCreateThread,
  onTogglePin,
  mobileOpen = false,
  onMobileOpenChange,
}: ChatSidebarProps) => {
  const filteredThreads = useMemo(
    () => filterThreads(threads, searchQuery),
    [threads, searchQuery]
  );

  const handleSelectThread = (threadId: string) => {
    onSelectThread(threadId);
    onMobileOpenChange?.(false);
  };

  const sharedProps = {
    activeThreadId,
    filteredThreads,
    isLoading,
    isCreatingThread,
    searchQuery,
    onSearchChange,
    onCreateThread,
    onSelectThread: handleSelectThread,
    onTogglePin,
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-[calc(100vh-3rem)] w-72 shrink-0 rounded-3xl border border-black/5 bg-white/70 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur md:flex md:flex-col">
        <SidebarContent {...sharedProps} onSelectThread={onSelectThread} />
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
