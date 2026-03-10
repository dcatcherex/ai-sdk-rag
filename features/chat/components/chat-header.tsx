'use client';

import { useState } from 'react';
import {
  BookOpenIcon,
  DownloadIcon,
  FileTextIcon,
  Maximize2Icon,
  MenuIcon,
  Minimize2Icon,
  TableOfContentsIcon,
  Trash2Icon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TokenUsageDisplay } from '@/components/token-usage-display';
import { CreditBalanceDisplay } from '@/components/credit-balance-display';
import type { ChatStatus } from 'ai';
import type { ThreadItem, RoutingMetadata, ChatMessageMetadata } from '../types';
import type { SystemPromptKey } from '@/lib/prompt';
import type { FontSize } from './message-list';

const FONT_SIZES: FontSize[] = ['sm', 'base', 'lg', 'xl'];

const PERSONA_LABELS: Record<SystemPromptKey, string> = {
  general_assistant: 'General',
  coding_copilot: 'Coding Copilot',
  product_manager: 'Product Manager',
  friendly_tutor: 'Friendly Tutor',
  data_analyst: 'Data Analyst',
  summarizer_editor: 'Summarizer',
  security_privacy_guard: 'Security Guard',
  research_librarian: 'Research Librarian',
  translation_localization: 'Translator',
  troubleshooting_debugger: 'Debugger',
};

type ChatHeaderProps = {
  activeThread: ThreadItem | undefined;
  status: ChatStatus;
  // Routing
  lastRouting: RoutingMetadata | null;
  lastRoutingModel:
    | {
        id: string;
        name: string;
      }
    | undefined;
  lastPersona?: string | null;
  // Actions
  onDeleteThread: (threadId: string) => void;
  isDeleting: boolean;
  onExport: (format: 'json' | 'markdown') => void;
  // Knowledge
  knowledgePanelOpen: boolean;
  onToggleKnowledgePanel: () => void;
  docCount: number;
  // Outline
  outlinePanelOpen: boolean;
  onToggleOutlinePanel: () => void;
  // Wide mode
  widenMode: boolean;
  onToggleWidenMode: () => void;
  // Font size
  fontSize: FontSize;
  onChangeFontSize: (size: FontSize) => void;
  onOpenMobileSidebar?: () => void;
};

export const ChatHeader = ({
  activeThread,
  status,
  lastRouting,
  lastRoutingModel,
  lastPersona,
  onDeleteThread,
  isDeleting,
  onExport,
  knowledgePanelOpen,
  onToggleKnowledgePanel,
  docCount,
  outlinePanelOpen,
  onToggleOutlinePanel,
  widenMode,
  onToggleWidenMode,
  fontSize,
  onChangeFontSize,
  onOpenMobileSidebar,
}: ChatHeaderProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleConfirmDelete = () => {
    if (!activeThread) {
      return;
    }
    onDeleteThread(activeThread.id);
    setIsDeleteDialogOpen(false);
  };

  return (
  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 dark:border-white/10 px-3 py-3 md:gap-3 md:px-6 md:py-4">
    <div className="flex items-center gap-2">
      {/* Mobile hamburger */}
      <Button
        size="icon"
        variant="ghost"
        className="md:hidden"
        onClick={onOpenMobileSidebar}
      >
        <MenuIcon className="size-5" />
      </Button>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground md:text-lg">
          {activeThread?.title ?? 'New chat'}
        </h2>
      </div>
    </div>
    <div className="flex items-center gap-1.5 md:gap-3">
      {lastPersona && lastPersona !== 'general_assistant' ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="hidden gap-1 text-xs sm:inline-flex">
                {lastPersona.startsWith('custom:') ? lastPersona.slice(7) : (PERSONA_LABELS[lastPersona as SystemPromptKey] ?? lastPersona)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">Auto-detected persona</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}

      {lastRouting?.mode === 'auto' ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="hidden gap-1 text-xs sm:inline-flex">
                Auto → {lastRoutingModel?.name ?? lastRouting.modelId}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">{lastRouting.reason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}

      <span className="hidden sm:inline-flex"><CreditBalanceDisplay /></span>

      {activeThread && <span className="hidden lg:inline-flex"><TokenUsageDisplay threadId={activeThread.id} /></span>}

      <div className="flex items-center gap-1 text-xs text-muted-foreground md:gap-2">
        {activeThread && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8 md:size-9">
                  <DownloadIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onExport('json')}>
                  <FileTextIcon className="mr-2 size-4" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('markdown')}>
                  <FileTextIcon className="mr-2 size-4" />
                  Export as Markdown
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 md:size-9"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={isDeleting}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete thread</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
        <div className="hidden items-center sm:flex">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 md:size-9 text-xs font-bold"
                  disabled={fontSize === FONT_SIZES[0]}
                  onClick={() => onChangeFontSize(FONT_SIZES[Math.max(0, FONT_SIZES.indexOf(fontSize) - 1)])}
                >
                  A-
                </Button>
              </TooltipTrigger>
              <TooltipContent>Decrease font size</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 md:size-9 text-sm font-bold"
                  disabled={fontSize === FONT_SIZES[FONT_SIZES.length - 1]}
                  onClick={() => onChangeFontSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, FONT_SIZES.indexOf(fontSize) + 1)])}
                >
                  A+
                </Button>
              </TooltipTrigger>
              <TooltipContent>Increase font size</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={widenMode ? 'default' : 'ghost'}
                onClick={onToggleWidenMode}
                className="size-8 md:size-9"
              >
                {widenMode ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{widenMode ? 'Exit wide mode' : 'Wide mode'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={outlinePanelOpen ? 'default' : 'ghost'}
                onClick={onToggleOutlinePanel}
                className="size-8 md:size-9"
              >
                <TableOfContentsIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Conversation outline</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={knowledgePanelOpen ? 'default' : 'ghost'}
                onClick={onToggleKnowledgePanel}
                className="relative size-8 md:size-9"
              >
                <BookOpenIcon className="size-4" />
                {docCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1.5 -right-1.5 size-4 justify-center p-0 text-[9px]"
                  >
                    {docCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Knowledge base</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="hidden sm:inline">
          {status === 'streaming'
            ? 'Streaming'
            : status === 'submitted'
              ? 'Thinking'
              : 'Ready'}
        </span>
      </div>
    </div>
    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete this thread?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The selected conversation will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isDeleting}>Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete thread'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
  );
};
