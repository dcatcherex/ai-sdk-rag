"use client";

import { forwardRef } from "react";
import {
  MoreVerticalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ThreadItem } from "../../types";

type Props = {
  thread: ThreadItem;
  isActive: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onRenameRequest: () => void;
  onDelete: () => void;
};

export const SidebarThreadRow = forwardRef<HTMLDivElement, Props>(({
  thread,
  isActive,
  onSelect,
  onTogglePin,
  onRenameRequest,
  onDelete,
}, ref) => (
  <div
    ref={ref}
    className={`group flex w-full items-center rounded-lg text-sm transition ${
      isActive
        ? "bg-muted font-medium text-foreground"
        : "text-foreground/80 hover:bg-muted/50"
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
          onClick={(e) => e.stopPropagation()}
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
          {thread.pinned ? (
            <PinOffIcon className="size-4" />
          ) : (
            <PinIcon className="size-4" />
          )}
          {thread.pinned ? "Unpin" : "Pin"}
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
                  <p className="truncate text-xs font-medium text-foreground">
                    Image theme
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Image created
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
));
SidebarThreadRow.displayName = "SidebarThreadRow";
