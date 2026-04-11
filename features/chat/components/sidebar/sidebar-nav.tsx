"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EllipsisIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PINNED_WORKSPACE_ITEM_IDS,
  WORKSPACE_ITEMS,
  WORKSPACE_ITEM_BY_ID,
  matchesWorkspaceItem,
  type WorkspaceItem,
} from "@/features/workspace/registry";
import type { WorkspaceItemId } from "@/features/workspace/catalog";
import { SidebarMoreMenuContent } from "./sidebar-more-menu";

export const NAV_REGISTRY = WORKSPACE_ITEMS;

export type NavItemId = WorkspaceItemId;
export type NavItem = WorkspaceItem;

export const DEFAULT_PINNED_IDS: NavItemId[] = DEFAULT_PINNED_WORKSPACE_ITEM_IDS;

type Props = {
  currentPath: string;
  activeThreadId: string;
  isCollapsed: boolean;
  isCreatingThread: boolean;
  pinnedItemIds: NavItemId[];
  hiddenItemIds: NavItemId[];
  onCreateThread: () => void;
  onSearchOpen: () => void;
  onTogglePin: (itemId: NavItemId) => void;
  onReorderPinned: (orderedItemIds: NavItemId[]) => void;
};

const NavButton = ({
  isCollapsed,
  tooltip,
  children,
}: {
  isCollapsed: boolean;
  tooltip: string;
  children: ReactNode;
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {isCollapsed ? (
        <TooltipContent side="right">{tooltip}</TooltipContent>
      ) : null}
    </Tooltip>
  </TooltipProvider>
);

function getPinnedItems(pinnedItemIds: NavItemId[]): NavItem[] {
  return pinnedItemIds
    .map((id) => WORKSPACE_ITEM_BY_ID[id])
    .filter((item): item is NavItem => item !== undefined);
}

export const SidebarNav = ({
  currentPath,
  activeThreadId,
  isCollapsed,
  isCreatingThread,
  pinnedItemIds,
  hiddenItemIds,
  onCreateThread,
  onSearchOpen,
  onTogglePin,
  onReorderPinned,
}: Props) => {
  const pinnedItems = getPinnedItems(pinnedItemIds);
  const hidden = new Set(hiddenItemIds);
  const visibleItems = NAV_REGISTRY.filter((item) => !hidden.has(item.id));
  const iconButtonClass = "size-9 shrink-0";
  const fullWidthButtonClass = "justify-start gap-2 w-full font-normal";

  if (isCollapsed) {
    return (
      <div className="mt-4 flex flex-col items-center space-y-2">
        <NavButton isCollapsed tooltip="New chat">
          <Button
            variant={currentPath === "/" && !activeThreadId ? "secondary" : "ghost"}
            size="icon"
            className={iconButtonClass}
            onClick={onCreateThread}
            disabled={isCreatingThread}
          >
            <PlusIcon className="size-4" />
          </Button>
        </NavButton>

        {pinnedItems.map((item) => (
          <NavButton key={item.href} isCollapsed tooltip={item.label}>
            <Button
              asChild
              variant={matchesWorkspaceItem(item, currentPath) ? "secondary" : "ghost"}
              size="icon"
              className={iconButtonClass}
            >
              <Link href={item.href} aria-label={item.label}>{item.icon}</Link>
            </Button>
          </NavButton>
        ))}

        <DropdownMenu>
          <NavButton isCollapsed tooltip="More">
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant={
                  visibleItems.some((item) => matchesWorkspaceItem(item, currentPath)) &&
                  !pinnedItems.some((item) => matchesWorkspaceItem(item, currentPath))
                    ? "secondary"
                    : "ghost"
                }
                size="icon"
                className={iconButtonClass}
                aria-label="Open more menu"
              >
                <EllipsisIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </NavButton>
          <DropdownMenuContent side="right" align="start" className="w-64 p-0">
            <SidebarMoreMenuContent
              currentPath={currentPath}
              pinnedItemIds={pinnedItemIds}
              hiddenItemIds={hiddenItemIds}
              onTogglePin={onTogglePin}
              onReorderPinned={onReorderPinned}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <NavButton isCollapsed={false} tooltip="New chat">
        <Button
          variant={currentPath === "/" && !activeThreadId ? "secondary" : "ghost"}
          size="sm"
          className={cn("flex-1", fullWidthButtonClass)}
          onClick={onCreateThread}
          disabled={isCreatingThread}
        >
          <PlusIcon className="size-4" />
          New chat
        </Button>
      </NavButton>

      {pinnedItems.map((item) => (
        <NavButton key={item.href} isCollapsed={false} tooltip={item.label}>
          <Button
            asChild
            variant={matchesWorkspaceItem(item, currentPath) ? "secondary" : "ghost"}
            size="sm"
            className={fullWidthButtonClass}
          >
            <Link href={item.href} aria-label={item.label}>
              {item.icon}
              {item.label}
            </Link>
          </Button>
        </NavButton>
      ))}
    </div>
  );
};
