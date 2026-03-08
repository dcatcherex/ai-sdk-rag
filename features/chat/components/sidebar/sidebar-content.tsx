"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BrainCircuitIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/theme";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ThreadItem } from "../../types";
import type { SessionData, UserProfileData } from "./types";
import { SidebarAccount } from "./sidebar-account";
import { SidebarNav } from "./sidebar-nav";
import { SidebarSearch } from "./sidebar-search";
import { SidebarThreadList } from "./sidebar-thread-list";

type Props = {
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
};

export const SidebarContent = ({
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
}: Props) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* Header */}
      <div
        className={cn(
          "flex items-start justify-between gap-2",
          isCollapsed && "justify-center",
        )}
      >
        {!isCollapsed && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-lg font-semibold text-foreground">
              Studio Chat
            </h1>
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
                  aria-label={
                    isCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                >
                  {isCollapsed ? (
                    <PanelLeftOpenIcon className="size-4" />
                  ) : (
                    <PanelLeftCloseIcon className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      {/* Nav */}
      <SidebarNav
        currentPath={currentPath}
        isCollapsed={isCollapsed}
        isCreatingThread={isCreatingThread}
        onCreateThread={onCreateThread}
        onSearchOpen={() => setSearchOpen(true)}
      />

      {/* Thread list */}
      {!isCollapsed ? (
        <SidebarThreadList
          threads={threads}
          isLoading={isLoading}
          activeThreadId={activeThreadId}
          onSelectThread={onSelectThread}
          onTogglePin={onTogglePin}
          onRenameThread={onRenameThread}
          onDeleteThread={onDeleteThread}
        />
      ) : (
        <div className="mt-4 flex-1" />
      )}

      {/* Footer: settings + account */}
      <div
        className={cn(
          "mt-auto border-t border-black/5 dark:border-white/10 pt-3",
          isCollapsed ? "flex flex-col items-center gap-2" : "space-y-1",
        )}
      >
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant={
                      currentPath.startsWith("/settings") ||
                      currentPath.startsWith("/models")
                        ? "secondary"
                        : "ghost"
                    }
                    size={isCollapsed ? "icon" : "sm"}
                    className={cn(
                      isCollapsed ? "size-9" : "justify-start gap-2 w-full",
                    )}
                  >
                    <SettingsIcon className="size-4" />
                    {!isCollapsed ? "Settings & help" : null}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              {isCollapsed ? (
                <TooltipContent side="right">Settings & help</TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent side="top" align="start" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/models">
                <BrainCircuitIcon className="size-4" />
                AI Models
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <PaletteIcon className="size-4" />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}
                >
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
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <SettingsIcon className="size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SidebarAccount
          sessionData={sessionData}
          userProfile={userProfile}
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
          isCollapsed={isCollapsed}
        />
      </div>

      {/* Search dialog */}
      <SidebarSearch
        threads={threads}
        isLoading={isLoading}
        activeThreadId={activeThreadId}
        query={searchQuery}
        open={searchOpen}
        onQueryChange={setSearchQuery}
        onOpenChange={setSearchOpen}
        onSelectThread={onSelectThread}
      />
    </>
  );
};
