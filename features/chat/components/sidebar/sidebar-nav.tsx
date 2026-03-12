"use client";

import Link from "next/link";
import {
  EllipsisIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavItem = {
  id: SidebarNavItemId;
  href: string;
  label: string;
  icon: React.ReactNode;
  matchFn: (path: string) => boolean;
};

export type SidebarNavItemId = "gallery" | "agents" | "certificate";

export const OPTIONAL_NAV_ITEMS: NavItem[] = [
  {
    id: "gallery",
    href: "/gallery",
    label: "Media gallery",
    icon: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>,
    matchFn: (p) => p.startsWith("/gallery"),
  },
  {
    id: "agents",
    href: "/agents",
    label: "Agents",
    icon: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8V4H8" /><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>,
    matchFn: (p) => p.startsWith("/agents"),
  },
  {
    id: "certificate",
    href: "/certificate",
    label: "Certificates",
    icon: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6" /><path d="m15.477 12.89 1.515 8.595L12 18l-4.992 3.485 1.515-8.596" /></svg>,
    matchFn: (p) => p.startsWith("/certificate"),
  },
];

export const DEFAULT_VISIBLE_SIDEBAR_ITEM_IDS: SidebarNavItemId[] =
  OPTIONAL_NAV_ITEMS.map((item) => item.id);

type Props = {
  currentPath: string;
  activeThreadId: string;
  isCollapsed: boolean;
  isCreatingThread: boolean;
  visibleItemIds: SidebarNavItemId[];
  onCreateThread: () => void;
  onSearchOpen: () => void;
  onToggleItemVisibility: (itemId: SidebarNavItemId, checked: boolean) => void;
};

const NavButton = ({
  isCollapsed,
  tooltip,
  children,
}: {
  isCollapsed: boolean;
  tooltip: string;
  children: React.ReactNode;
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

export const SidebarNav = ({
  currentPath,
  activeThreadId,
  isCollapsed,
  isCreatingThread,
  visibleItemIds,
  onCreateThread,
  onSearchOpen,
  onToggleItemVisibility,
}: Props) => {
  const fullWidthButtonClass = "justify-start gap-2 w-full font-normal";
  const iconButtonClass = "size-9 shrink-0";
  const visibleItems = OPTIONAL_NAV_ITEMS.filter((item) =>
    visibleItemIds.includes(item.id),
  );

  return (
    <div
      className={cn(
        "mt-4 space-y-2",
        isCollapsed && "flex flex-col items-center",
      )}
    >
      {isCollapsed ? (
        <>
          <NavButton isCollapsed={isCollapsed} tooltip="New chat">
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

          {visibleItems.map(({ href, label, icon, matchFn }) => (
            <NavButton key={href} isCollapsed={isCollapsed} tooltip={label}>
              <Button
                asChild
                variant={matchFn(currentPath) ? "secondary" : "ghost"}
                size="icon"
                className={iconButtonClass}
              >
                <Link href={href} aria-label={label}>
                  {icon}
                </Link>
              </Button>
            </NavButton>
          ))}

          <NavButton isCollapsed={isCollapsed} tooltip="Search chats">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={iconButtonClass}
              onClick={onSearchOpen}
            >
              <SearchIcon className="size-4" />
            </Button>
          </NavButton>

          <DropdownMenu>
            <NavButton isCollapsed={isCollapsed} tooltip="More">
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={OPTIONAL_NAV_ITEMS.some(({ matchFn }) => matchFn(currentPath)) ? "secondary" : "ghost"}
                  size="icon"
                  className={iconButtonClass}
                  aria-label="Open more menu"
                >
                  <EllipsisIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </NavButton>
            <DropdownMenuContent side="right" align="start" className="w-56">
              <DropdownMenuLabel>More</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {OPTIONAL_NAV_ITEMS.map(({ id, label, icon }) => (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={visibleItemIds.includes(id)}
                  onCheckedChange={(checked) =>
                    onToggleItemVisibility(id, checked === true)
                  }
                >
                  {icon}
                  <span className="flex-1">{label}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <NavButton isCollapsed={isCollapsed} tooltip="New chat">
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
          </div>

          {visibleItems.map(({ href, label, icon, matchFn }) => (
            <NavButton key={href} isCollapsed={isCollapsed} tooltip={label}>
              <Button
                asChild
                variant={matchFn(currentPath) ? "secondary" : "ghost"}
                size="sm"
                className={fullWidthButtonClass}
              >
                <Link href={href} aria-label={label}>
                  {icon}
                  {label}
                </Link>
              </Button>
            </NavButton>
          ))}
        </>
      )}
    </div>
  );
};
