"use client";

import { useRef } from "react";
import { MessageSquareIcon, SearchIcon, XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ThreadItem } from "../../types";

type Props = {
  threads: ThreadItem[];
  isLoading: boolean;
  activeThreadId: string;
  query: string;
  open: boolean;
  onQueryChange: (query: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelectThread: (threadId: string) => void;
};

export const SidebarSearch = ({
  threads,
  isLoading,
  activeThreadId,
  query,
  open,
  onQueryChange,
  onOpenChange,
  onSelectThread,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? threads.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          (t.preview ?? "").toLowerCase().includes(query.toLowerCase()),
      )
    : threads;

  const handleSelect = (threadId: string) => {
    onSelectThread(threadId);
    onOpenChange(false);
    onQueryChange("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) onQueryChange("");
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="flex items-center border-b px-3">
          <SearchIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search chats..."
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto py-2">
          {isLoading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No chats found.
            </p>
          ) : (
            filtered.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => handleSelect(thread.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-muted/60",
                  thread.id === activeThreadId && "bg-muted",
                )}
              >
                <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{thread.title}</p>
                  {thread.preview ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {thread.preview}
                    </p>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
