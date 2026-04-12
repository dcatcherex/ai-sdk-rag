'use client';

import { useState } from 'react';
import {
  BookOpenIcon,
  DownloadIcon,
  FileTextIcon,
  MenuIcon,
  MoreHorizontalIcon,
  PanelRightOpenIcon,
  Trash2Icon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChatStatus } from 'ai';

import type { ThreadItem, RoutingMetadata } from '../types';
import type { FontSize } from './message-list';

const FONT_SIZES: FontSize[] = ['sm', 'base', 'lg', 'xl'];

type ChatHeaderProps = {
  activeThread: ThreadItem | undefined;
  status: ChatStatus;
  lastRouting: RoutingMetadata | null;
  lastRoutingModel:
    | {
        id: string;
        name: string;
      }
    | undefined;
  onDeleteThread: (threadId: string) => void;
  isDeleting: boolean;
  onExport: (format: 'json' | 'markdown') => void;
  knowledgePanelOpen: boolean;
  onToggleKnowledgePanel: () => void;
  docCount: number;
  workingMemoryOpen: boolean;
  onToggleWorkingMemory: () => void;
  outlinePanelOpen: boolean;
  onToggleOutlinePanel: () => void;
  widenMode: boolean;
  onToggleWidenMode: () => void;
  fontSize: FontSize;
  onChangeFontSize: (size: FontSize) => void;
  onOpenMobileSidebar?: () => void;
};

export const ChatHeader = ({
  activeThread,
  status,
  lastRouting: _lastRouting,
  lastRoutingModel,
  onDeleteThread,
  isDeleting,
  onExport,
  knowledgePanelOpen,
  onToggleKnowledgePanel,
  docCount,
  workingMemoryOpen,
  onToggleWorkingMemory,
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
  const headerSubtitle = activeThread
    ? (lastRoutingModel ? `กำลังใช้ ${lastRoutingModel.name}` : 'พร้อมช่วยงานถัดไปของคุณ')
    : 'เริ่มจากงาน คำถาม หรือร่างข้อความที่คุณอยากให้ช่วย';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 px-3 py-2 dark:border-border md:gap-3 md:px-6 md:py-1.5">
      <div className="flex items-center gap-2">
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
          <p className="truncate text-xs text-muted-foreground">{headerSubtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
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
                    className="absolute -right-1.5 -top-1.5 size-4 justify-center p-0 text-[9px]"
                  >
                    {docCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Knowledge base</TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
            <DropdownMenuItem onClick={onToggleOutlinePanel}>
              <PanelRightOpenIcon className="mr-2 size-4" />
              {outlinePanelOpen ? 'Hide outline' : 'Show outline'}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={onToggleWorkingMemory}
              disabled={!activeThread || status === 'submitted'}
            >
              <BookOpenIcon className="mr-2 size-4" />
              {workingMemoryOpen ? 'Hide working memory' : 'Show working memory'}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

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
            <DropdownMenuItem onClick={onToggleWidenMode}>
              <PanelRightOpenIcon className="mr-2 size-4" />
              {widenMode ? 'Exit wide mode' : 'Enter wide mode'}
            </DropdownMenuItem>

            {activeThread && (
              <>
                <DropdownMenuSeparator />

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
