'use client';

import { useMemo, useState } from 'react';
import { MoreVerticalIcon, PencilIcon, PinIcon, PinOffIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  onRenameThread: (threadId: string, title: string) => void;
  onDeleteThread: (threadId: string) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
};

const ThreadRow = ({
  thread,
  isActive,
  onSelect,
  onTogglePin,
  onRenameRequest,
  onDelete,
}: {
  thread: ThreadItem;
  isActive: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onRenameRequest: () => void;
  onDelete: () => void;
}) => (
  <div
    className={`group flex w-full items-center rounded-lg text-sm transition ${
      isActive
        ? 'bg-muted font-medium text-foreground'
        : 'text-foreground/80 hover:bg-muted/50'
    }`}
  >
    <button
      className="min-w-0 flex-1 px-3 py-2 text-left"
      onClick={onSelect}
      type="button"
    >
      <p className="truncate">{thread.title}</p>
      <p className="truncate text-xs font-normal text-muted-foreground">
        {thread.preview || formatRelativeTime(thread.updatedAtMs)}
      </p>
    </button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mr-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
          }}
          aria-label="Thread actions"
        >
          <MoreVerticalIcon className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
        >
          {thread.pinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
          {thread.pinned ? 'Unpin' : 'Pin'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onRenameRequest();
          }}
        >
          <PencilIcon className="size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2Icon className="size-4" />
          Delete
        </DropdownMenuItem>

        {thread.hasGeneratedImage && thread.imageThumbnailUrl ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-1.5">
                <img
                  src={thread.imageThumbnailUrl}
                  alt={`${thread.title} generated theme`}
                  className="size-10 rounded object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">Image theme</p>
                  <p className="truncate text-[11px] text-muted-foreground">Image created</p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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
  onRenameThread,
  onDeleteThread,
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
  onRenameThread: (threadId: string, title: string) => void;
  onDeleteThread: (threadId: string) => void;
}) => {
  const pinnedThreads = filteredThreads.filter((t) => t.pinned);
  const recentThreads = filteredThreads.filter((t) => !t.pinned);
  const [renameTarget, setRenameTarget] = useState<ThreadItem | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const handleRenameSubmit = () => {
    if (!renameTarget) {
      return;
    }
    const trimmedTitle = renameTitle.trim();
    if (!trimmedTitle || trimmedTitle === renameTarget.title) {
      setRenameTarget(null);
      setRenameTitle('');
      return;
    }
    onRenameThread(renameTarget.id, trimmedTitle);
    setRenameTarget(null);
    setRenameTitle('');
  };

  const handleRenameDialogChange = (open: boolean) => {
    if (open) {
      return;
    }
    setRenameTarget(null);
    setRenameTitle('');
  };

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
                    onRenameRequest={() => {
                      setRenameTarget(thread);
                      setRenameTitle(thread.title);
                    }}
                    onDelete={() => onDeleteThread(thread.id)}
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
                    onRenameRequest={() => {
                      setRenameTarget(thread);
                      setRenameTitle(thread.title);
                    }}
                    onDelete={() => onDeleteThread(thread.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={Boolean(renameTarget)} onOpenChange={handleRenameDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename thread</DialogTitle>
            <DialogDescription>Choose a new title for this conversation.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            placeholder="Thread title"
            maxLength={120}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => handleRenameDialogChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  onRenameThread,
  onDeleteThread,
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
    onRenameThread,
    onDeleteThread,
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
