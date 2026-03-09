"use client";

import Link from "next/link";
import {
  AwardIcon,
  BotIcon,
  ImageIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchFn: (path: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/gallery",
    label: "Media gallery",
    icon: <ImageIcon className="size-4" />,
    matchFn: (p) => p.startsWith("/gallery"),
  },
  {
    href: "/agents",
    label: "Agents",
    icon: <BotIcon className="size-4" />,
    matchFn: (p) => p.startsWith("/agents"),
  },
  {
    href: "/certificate",
    label: "Certificates",
    icon: <AwardIcon className="size-4" />,
    matchFn: (p) => p.startsWith("/certificate"),
  },
];

type Props = {
  currentPath: string;
  activeThreadId: string;
  isCollapsed: boolean;
  isCreatingThread: boolean;
  onCreateThread: () => void;
  onSearchOpen: () => void;
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
  onCreateThread,
  onSearchOpen,
}: Props) => {
  const btnClass = (active: boolean) =>
    cn(active ? "secondary" : "ghost", isCollapsed ? "size-9" : "justify-start gap-2 w-full");

  return (
    <div
      className={cn(
        "mt-4 space-y-2",
        isCollapsed && "flex flex-col items-center",
      )}
    >
      <NavButton isCollapsed={isCollapsed} tooltip="New chat">
        <Button
          variant={currentPath === "/" && !activeThreadId ? "secondary" : "ghost"}
          size={isCollapsed ? "icon" : "sm"}
          className={cn(isCollapsed ? "size-9" : "justify-start gap-2 w-full")}
          onClick={onCreateThread}
          disabled={isCreatingThread}
        >
          <PlusIcon className="size-4" />
          {!isCollapsed ? "New chat" : null}
        </Button>
      </NavButton>

      {NAV_ITEMS.map(({ href, label, icon, matchFn }) => (
        <NavButton key={href} isCollapsed={isCollapsed} tooltip={label}>
          <Button
            asChild
            variant={matchFn(currentPath) ? "secondary" : "ghost"}
            size={isCollapsed ? "icon" : "sm"}
            className={cn(
              isCollapsed ? "size-9" : "justify-start gap-2 w-full",
            )}
          >
            <Link href={href} aria-label={label}>
              {icon}
              {!isCollapsed ? label : null}
            </Link>
          </Button>
        </NavButton>
      ))}

      <NavButton isCollapsed={isCollapsed} tooltip="Search chats">
        <Button
          type="button"
          variant="ghost"
          size={isCollapsed ? "icon" : "sm"}
          className={cn(isCollapsed ? "size-9" : "justify-start gap-2 w-full")}
          onClick={onSearchOpen}
        >
          <SearchIcon className="size-4" />
          {!isCollapsed ? (
            <span className="flex-1 text-left text-muted-foreground font-normal">
              Search chats
              <kbd className="ml-2 text-[10px] opacity-50">⌘/</kbd>
            </span>
          ) : null}
        </Button>
      </NavButton>
    </div>
  );
};
