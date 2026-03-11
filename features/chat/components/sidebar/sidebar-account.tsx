"use client";

import Link from "next/link";
import {
  LogOutIcon,
  UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { SessionData, UserProfileData } from "./types";

type Props = {
  sessionData: SessionData;
  userProfile: UserProfileData;
  isSigningOut: boolean;
  onSignOut: () => void;
  isCollapsed: boolean;
};

export const SidebarAccount = ({
  sessionData,
  userProfile,
  isSigningOut,
  onSignOut,
  isCollapsed,
}: Props) => {
  if (!sessionData?.user) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={isCollapsed ? "icon" : "sm"}
              className={cn("rounded-full", isCollapsed ? "size-9" : "px-3")}
              asChild
            >
              <Link href="/sign-in" aria-label="Sign in">
                <UserIcon className="size-4" />
                {!isCollapsed ? <span className="ml-2">Sign in</span> : null}
              </Link>
            </Button>
          </TooltipTrigger>
          {isCollapsed ? (
            <TooltipContent side="right">Sign in</TooltipContent>
          ) : null}
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
                className="size-9 rounded-full border border-black/5 dark:border-border bg-white/80 dark:bg-muted"
              >
                <Avatar size="sm">
                  {userProfile.image ? (
                    <AvatarImage
                      src={userProfile.image}
                      alt={userProfile.displayName}
                    />
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
      <DropdownMenuContent
        align={isCollapsed ? "center" : "end"}
        className="w-56"
      >
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">
            {userProfile.displayName}
          </span>
          {userProfile.email ? (
            <span className="text-xs text-muted-foreground">
              {userProfile.email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} disabled={isSigningOut}>
          <LogOutIcon className="size-4" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
