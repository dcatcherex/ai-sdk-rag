'use client';

import { useState } from 'react';
import {
  BookOpenIcon,
  DownloadIcon,
  FileTextIcon,
  Maximize2Icon,
  MenuIcon,
  Minimize2Icon,
  MoreHorizontalIcon,
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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import type { ChatStatus } from 'ai';
import type { ThreadItem, RoutingMetadata } from '../types';
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
    if (!activeThread) return;
    onDeleteThread(activeThread.id);
    setIsDeleteDialogOpen(false);
  };

  const fontSizeIndex = FONT_SIZES.indexOf(fontSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 dark:border-border px-3 py-2 md:gap-3 md:px-6 md:py-1.5">
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
          <h2 className="truncate text-base font-medium text-foreground md:text-lg">
            {activeThread?.title ?? 'New chat'}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Wide mode */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={widenMode ? 'default' : 'ghost'}
                onClick={onToggleWidenMode}
                className="size-8 hover:cursor-pointer"
              >
                {widenMode ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{widenMode ? 'Exit wide mode' : 'Wide mode'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Outline */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={outlinePanelOpen ? 'default' : 'ghost'}
                onClick={onToggleOutlinePanel}
                className="size-8 hover:cursor-pointer"
              >
                <TableOfContentsIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Outline</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Knowledge base — stays visible because of the badge */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={knowledgePanelOpen ? 'default' : 'ghost'}
                onClick={onToggleKnowledgePanel}
                className="relative size-8 hover:cursor-pointer"
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

        {/* More menu */}
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="size-8 hover:cursor-pointer">
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More options</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="end" className="w-52">
            {/* Font size */}
            <DropdownMenuItem
              onClick={() => onChangeFontSize(FONT_SIZES[Math.max(0, fontSizeIndex - 1)])}
              disabled={fontSizeIndex === 0}
            >
              <span className="mr-2 text-xs font-bold">A-</span>
              Decrease font size
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onChangeFontSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, fontSizeIndex + 1)])}
              disabled={fontSizeIndex === FONT_SIZES.length - 1}
            >
              <span className="mr-2 text-sm font-bold">A+</span>
              Increase font size
            </DropdownMenuItem>

            {activeThread && (
              <>
                <DropdownMenuSeparator />

                {/* Export submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <DownloadIcon className="mr-2 size-4" />
                    Export
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => onExport('json')}>
                      <FileTextIcon className="mr-2 size-4" />
                      Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('markdown')}>
                      <FileTextIcon className="mr-2 size-4" />
                      Export as Markdown
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Delete */}
                <DropdownMenuItem
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2Icon className="mr-2 size-4" />
                  Delete thread
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
