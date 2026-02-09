'use client';

import { useMemo } from 'react';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
};

const SidebarContent = ({
  activeThreadId,
  filteredThreads,
  isLoading,
  isCreatingThread,
  searchQuery,
  onSearchChange,
  onCreateThread,
  onSelectThread,
}: {
  activeThreadId: string;
  filteredThreads: ThreadItem[];
  isLoading: boolean;
  isCreatingThread: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCreateThread: () => void;
  onSelectThread: (threadId: string) => void;
}) => (
  <>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Workspace
        </p>
        <h1 className="text-lg font-semibold text-foreground">Studio Chat</h1>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              onClick={onCreateThread}
              disabled={isCreatingThread}
            >
              <PlusIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New thread (⌘K)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <div className="relative mt-4">
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

    <div className="mt-4 space-y-2 overflow-y-auto">
      {isLoading ? (
        <p className="px-3 text-xs text-muted-foreground">Loading threads…</p>
      ) : filteredThreads.length === 0 ? (
        <p className="px-3 text-xs text-muted-foreground">
          {searchQuery ? 'No threads found.' : 'No threads yet. Start a new chat.'}
        </p>
      ) : (
        filteredThreads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          return (
            <button
              key={thread.id}
              className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                isActive
                  ? 'border-transparent bg-foreground text-background shadow-lg shadow-black/10'
                  : 'border-black/5 bg-white/70 text-foreground hover:border-black/10 hover:bg-white'
              }`}
              onClick={() => onSelectThread(thread.id)}
              type="button"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{thread.title}</span>
                <span
                  className={`text-[11px] ${
                    isActive ? 'text-background/80' : 'text-muted-foreground'
                  }`}
                >
                  {formatRelativeTime(thread.updatedAtMs)}
                </span>
              </div>
              <p
                className={`mt-2 line-clamp-2 text-xs leading-relaxed ${
                  isActive ? 'text-background/70' : 'text-muted-foreground'
                }`}
              >
                {thread.preview}
              </p>
            </button>
          );
        })
      )}
    </div>
  </>
);

export const ChatSidebar = ({
  activeThreadId,
  threads,
  isLoading,
  isCreatingThread,
  searchQuery,
  onSearchChange,
  onSelectThread,
  onCreateThread,
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
