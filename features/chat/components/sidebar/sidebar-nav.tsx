"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
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
import { EllipsisIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarMoreMenuContent } from "./sidebar-more-menu";

// ─── Nav Registry ────────────────────────────────────────────────────────────
// Single source of truth for all sidebar pages.
// To add a new page: append one entry here. No other files need changing.

export const NAV_REGISTRY = [
  {
    id: "gallery" as const,
    href: "/gallery",
    label: "Media gallery",
    defaultPinned: true,
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    ),
    matchFn: (p: string) => p.startsWith("/gallery"),
  },
  {
    id: "agents" as const,
    href: "/agents",
    label: "Agents",
    defaultPinned: true,
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 8V4H8" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M2 14h2" /><path d="M20 14h2" />
        <path d="M15 13v2" /><path d="M9 13v2" />
      </svg>
    ),
    matchFn: (p: string) => p.startsWith("/agents"),
  },
  {
    id: "certificate" as const,
    href: "/certificate",
    label: "Certificates",
    defaultPinned: true,
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="6" />
        <path d="m15.477 12.89 1.515 8.595L12 18l-4.992 3.485 1.515-8.596" />
      </svg>
    ),
    matchFn: (p: string) => p.startsWith("/certificate"),
  },
  {
    id: "skills" as const,
    href: "/skills",
    label: "Skills",
    defaultPinned: true,
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    matchFn: (p: string) => p.startsWith("/skills"),
  },
  {
    id: "knowledge" as const,
    href: "/knowledge",
    label: "Knowledge Base",
    defaultPinned: false,
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    matchFn: (p: string) => p.startsWith("/knowledge"),
  },
  {
    id: "support" as const,
    href: "/support",
    label: "Support Inbox",
    defaultPinned: false,
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    matchFn: (p: string) => p.startsWith("/support"),
  },
] as const;

export type NavItemId = (typeof NAV_REGISTRY)[number]["id"];
export type NavItem = (typeof NAV_REGISTRY)[number];

export const DEFAULT_PINNED_IDS: NavItemId[] = NAV_REGISTRY.filter(
  (item) => item.defaultPinned,
).map((item) => item.id);

// ─── SidebarNav ───────────────────────────────────────────────────────────────

type Props = {
  currentPath: string;
  activeThreadId: string;
  isCollapsed: boolean;
  isCreatingThread: boolean;
  pinnedItemIds: NavItemId[];
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
  pinnedItemIds,
  onCreateThread,
  onSearchOpen,
  onTogglePin,
  onReorderPinned,
}: Props) => {
  const pinnedItems = pinnedItemIds
    .map((id) => NAV_REGISTRY.find((item) => item.id === id))
    .filter((item): item is NavItem => item !== undefined);

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

        {pinnedItems.map(({ href, label, icon, matchFn }) => (
          <NavButton key={href} isCollapsed tooltip={label}>
            <Button
              asChild
              variant={matchFn(currentPath) ? "secondary" : "ghost"}
              size="icon"
              className={iconButtonClass}
            >
              <Link href={href} aria-label={label}>{icon}</Link>
            </Button>
          </NavButton>
        ))}

        {/* Collapsed ⋮ — opens the full more menu */}
        <DropdownMenu>
          <NavButton isCollapsed tooltip="More">
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant={
                  NAV_REGISTRY.some(({ matchFn }) => matchFn(currentPath)) &&
                  !pinnedItems.some(({ matchFn }) => matchFn(currentPath))
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

      {pinnedItems.map(({ href, label, icon, matchFn }) => (
        <NavButton key={href} isCollapsed={false} tooltip={label}>
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
    </div>
  );
};
