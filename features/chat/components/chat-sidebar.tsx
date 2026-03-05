'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ImageIcon,
  LogOutIcon,
  MoreVerticalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UserIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { cn } from '@/lib/utils';

import { formatRelativeTime } from '../utils/format-relative-time';
import { filterThreads } from '../utils/filter-threads';
import type { ThreadItem } from '../types';

type UserProfileData = {
  displayName: string;
  email: string;
  initials: string;
  image: string;
};

type SessionData = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
} | null;

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'chat-sidebar-collapsed';

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
  sessionData: SessionData;
  userProfile: UserProfileData;
  isSigningOut: boolean;
  onSignOut: () => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
};

type SidebarAccountProps = {
  sessionData: SessionData;
  userProfile: UserProfileData;
  isSigningOut: boolean;
  onSignOut: () => void;
  isCollapsed: boolean;
};

const SidebarAccount = ({
  sessionData,
  userProfile,
  isSigningOut,
  onSignOut,
  isCollapsed,
}: SidebarAccountProps) => {
  if (!sessionData?.user) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={isCollapsed ? 'icon' : 'sm'}
              className={cn('rounded-full', isCollapsed ? 'size-9' : 'px-3')}
              asChild
            >
              <Link href="/sign-in" aria-label="Sign in">
                <UserIcon className="size-4" />
                {!isCollapsed ? <span className="ml-2">Sign in</span> : null}
              </Link>
            </Button>
          </TooltipTrigger>
          {isCollapsed ? <TooltipContent side="right">Sign in</TooltipContent> : null}
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 rounded-full border border-black/5 bg-white/80"
              >
                <Avatar size="sm">
                  {userProfile.image ? (
                    <AvatarImage src={userProfile.image} alt={userProfile.displayName} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                    {userProfile.initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Account</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align={isCollapsed ? 'center' : 'end'} className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">
            {userProfile.displayName}
          </span>
          {userProfile.email ? (
            <span className="text-xs text-muted-foreground">{userProfile.email}</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} disabled={isSigningOut}>
          <LogOutIcon className="size-4" />
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  sessionData,
  userProfile,
  isSigningOut,
  onSignOut,
  currentPath,
  isCollapsed = false,
  onToggleCollapse,
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
  sessionData: SessionData;
  userProfile: UserProfileData;
  isSigningOut: boolean;
  onSignOut: () => void;
  currentPath: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
      <div className={cn('flex items-start justify-between gap-2', isCollapsed && 'justify-center')}>
        {!isCollapsed && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-lg font-semibold text-foreground">Studio Chat</h1>
          </div>
        )}

        {onToggleCollapse ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={onToggleCollapse}
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {isCollapsed ? <PanelLeftOpenIcon className="size-4" /> : <PanelLeftCloseIcon className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      <div className={cn('mt-4 space-y-2', isCollapsed && 'flex flex-col items-center')}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={currentPath === '/' ? 'secondary' : 'ghost'}
                size={isCollapsed ? 'icon' : 'sm'}
                className={cn('justify-start gap-2', isCollapsed ? 'size-9' : 'w-full')}
                onClick={onCreateThread}
                disabled={isCreatingThread}
              >
                <PlusIcon className="size-4" />
                {!isCollapsed ? 'New chat' : null}
              </Button>
            </TooltipTrigger>
            {isCollapsed ? <TooltipContent side="right">New chat</TooltipContent> : null}
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant={currentPath.startsWith('/gallery') ? 'secondary' : 'ghost'}
                size={isCollapsed ? 'icon' : 'sm'}
                className={cn('justify-start gap-2', isCollapsed ? 'size-9' : 'w-full')}
              >
                <Link href="/gallery" aria-label="Media gallery">
                  <ImageIcon className="size-4" />
                  {!isCollapsed ? 'Media gallery' : null}
                </Link>
              </Button>
            </TooltipTrigger>
            {isCollapsed ? <TooltipContent side="right">Media gallery</TooltipContent> : null}
          </Tooltip>
        </TooltipProvider>
      </div>

      {!isCollapsed ? (
        <>
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
        </>
      ) : (
        <div className="mt-4 flex-1" />
      )}

      <div className={cn('mt-auto border-t border-black/5 pt-3', isCollapsed ? 'flex justify-center' : 'flex')}>
        <SidebarAccount
          sessionData={sessionData}
          userProfile={userProfile}
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
          isCollapsed={isCollapsed}
        />
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
  sessionData,
  userProfile,
  isSigningOut,
  onSignOut,
  mobileOpen = false,
  onMobileOpenChange,
}: ChatSidebarProps) => {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (stored === null) {
      return true;
    }

    return stored === 'true';
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

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
    sessionData,
    userProfile,
    isSigningOut,
    onSignOut,
    currentPath: pathname,
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden h-[calc(100vh-3rem)] shrink-0 rounded-3xl border border-black/5 bg-white/70 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur transition-all md:flex md:flex-col',
          isCollapsed ? 'w-20 p-3' : 'w-72 p-5'
        )}
      >
        <SidebarContent
          {...sharedProps}
          onSelectThread={onSelectThread}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
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
