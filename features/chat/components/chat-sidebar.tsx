'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BotIcon,
  BrainCircuitIcon,
  ImageIcon,
  LogOutIcon,
  SettingsIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  MoreVerticalIcon,
  PaletteIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/lib/theme';
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
  const { theme, setTheme } = useTheme();

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
                className="size-9 rounded-full border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-800"
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PaletteIcon className="size-4" />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
              <DropdownMenuRadioItem value="light">
                <SunIcon className="size-4" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <MoonIcon className="size-4" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <MonitorIcon className="size-4" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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
  threads,
  isLoading,
  isCreatingThread,
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
  threads: ThreadItem[];
  isLoading: boolean;
  isCreatingThread: boolean;
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
  const pinnedThreads = threads.filter((t) => t.pinned);
  const recentThreads = threads.filter((t) => !t.pinned);
  const [renameTarget, setRenameTarget] = useState<ThreadItem | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ThreadItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [popupQuery, setPopupQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredForPopup = useMemo(
    () => (popupQuery.trim() ? threads.filter((t) =>
      t.title.toLowerCase().includes(popupQuery.toLowerCase()) ||
      (t.preview ?? '').toLowerCase().includes(popupQuery.toLowerCase())
    ) : threads),
    [threads, popupQuery]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSearchOpenChange = (open: boolean) => {
    setSearchOpen(open);
    if (!open) setPopupQuery('');
  };

  const handleSelectFromPopup = (threadId: string) => {
    onSelectThread(threadId);
    handleSearchOpenChange(false);
  };

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

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant={currentPath.startsWith('/models') ? 'secondary' : 'ghost'}
                size={isCollapsed ? 'icon' : 'sm'}
                className={cn('justify-start gap-2', isCollapsed ? 'size-9' : 'w-full')}
              >
                <Link href="/models" aria-label="AI Models">
                  <BrainCircuitIcon className="size-4" />
                  {!isCollapsed ? 'AI Models' : null}
                </Link>
              </Button>
            </TooltipTrigger>
            {isCollapsed ? <TooltipContent side="right">AI Models</TooltipContent> : null}
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant={currentPath.startsWith('/agents') ? 'secondary' : 'ghost'}
                size={isCollapsed ? 'icon' : 'sm'}
                className={cn('justify-start gap-2', isCollapsed ? 'size-9' : 'w-full')}
              >
                <Link href="/agents" aria-label="Agents">
                  <BotIcon className="size-4" />
                  {!isCollapsed ? 'Agents' : null}
                </Link>
              </Button>
            </TooltipTrigger>
            {isCollapsed ? <TooltipContent side="right">Agents</TooltipContent> : null}
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant={currentPath.startsWith('/settings') ? 'secondary' : 'ghost'}
                size={isCollapsed ? 'icon' : 'sm'}
                className={cn('justify-start gap-2', isCollapsed ? 'size-9' : 'w-full')}
              >
                <Link href="/settings" aria-label="Settings">
                  <SettingsIcon className="size-4" />
                  {!isCollapsed ? 'Settings' : null}
                </Link>
              </Button>
            </TooltipTrigger>
            {isCollapsed ? <TooltipContent side="right">Settings</TooltipContent> : null}
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size={isCollapsed ? 'icon' : 'sm'}
                className={cn('justify-start gap-2', isCollapsed ? 'size-9' : 'w-full')}
                onClick={() => setSearchOpen(true)}
              >
                <SearchIcon className="size-4" />
                {!isCollapsed ? (
                  <span className="flex-1 text-left text-muted-foreground font-normal">
                    Search chats
                    <kbd className="ml-2 text-[10px] opacity-50">⌘/</kbd>
                  </span>
                ) : null}
              </Button>
            </TooltipTrigger>
            {isCollapsed ? <TooltipContent side="right">Search chats</TooltipContent> : null}
          </Tooltip>
        </TooltipProvider>
      </div>

      {!isCollapsed ? (
        <>
          <div className="-mx-2 mt-4 flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="px-3 text-xs text-muted-foreground">Loading threads…</p>
            ) : threads.length === 0 ? (
              <p className="px-3 text-xs text-muted-foreground">No threads yet. Start a new chat.</p>
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
                        onDelete={() => setDeleteTarget(thread)}
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
                        onDelete={() => setDeleteTarget(thread)}
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

      <div className={cn('mt-auto border-t border-black/5 dark:border-white/10 pt-3', isCollapsed ? 'flex justify-center' : 'flex')}>
        <SidebarAccount
          sessionData={sessionData}
          userProfile={userProfile}
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
          isCollapsed={isCollapsed}
        />
      </div>

      <Dialog open={searchOpen} onOpenChange={handleSearchOpenChange}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <div className="flex items-center border-b px-3">
            <SearchIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              autoFocus
              value={popupQuery}
              onChange={(e) => setPopupQuery(e.target.value)}
              placeholder="Search chats..."
              className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            {popupQuery && (
              <button
                type="button"
                onClick={() => setPopupQuery('')}
                className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto py-2">
            {isLoading ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
            ) : filteredForPopup.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No chats found.</p>
            ) : (
              filteredForPopup.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => handleSelectFromPopup(thread.id)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-muted/60',
                    thread.id === activeThreadId && 'bg-muted'
                  )}
                >
                  <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{thread.title}</p>
                    {thread.preview ? (
                      <p className="truncate text-xs text-muted-foreground">{thread.preview}</p>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

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

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete thread</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">&ldquo;{deleteTarget?.title}&rdquo;</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  onDeleteThread(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </Button>
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
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden h-[calc(100vh-3rem)] shrink-0 rounded-3xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-900/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] dark:shadow-[0_20px_60px_-40px_rgba(0,0,0,0.6)] backdrop-blur transition-all md:flex md:flex-col',
          isCollapsed ? 'w-20 p-3' : 'w-72 p-5'
        )}
      >
        <SidebarContent
          {...sharedProps}
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
