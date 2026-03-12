"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ThreadItem } from "../../types";
import { SidebarThreadRow } from "./sidebar-thread-row";

type Props = {
  threads: ThreadItem[];
  isLoading: boolean;
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onTogglePin: (threadId: string, pinned: boolean) => void;
  onRenameThread: (threadId: string, title: string) => void;
  onDeleteThread: (threadId: string) => void;
};

export const SidebarThreadList = ({
  threads,
  isLoading,
  activeThreadId,
  onSelectThread,
  onTogglePin,
  onRenameThread,
  onDeleteThread,
}: Props) => {
  const [renameTarget, setRenameTarget] = useState<ThreadItem | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ThreadItem | null>(null);

  const activeRowRef = useRef<HTMLDivElement>(null);
  const clickedIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    // Skip on initial mount — component remounts on every navigation so
    // activeThreadId is already set, but we should NOT auto-scroll then.
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    // Skip when the user just clicked this row themselves
    if (clickedIdRef.current === activeThreadId) {
      clickedIdRef.current = null;
      return;
    }
    // External change (new thread, keyboard nav) — scroll only if off-screen
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeThreadId]);

  const pinnedThreads = threads.filter((t) => t.pinned);
  const recentThreads = threads.filter((t) => !t.pinned);

  const handleRenameSubmit = () => {
    if (!renameTarget) return;
    const trimmed = renameTitle.trim();
    if (trimmed && trimmed !== renameTarget.title) {
      onRenameThread(renameTarget.id, trimmed);
    }
    setRenameTarget(null);
    setRenameTitle("");
  };

  const handleRenameClose = (open: boolean) => {
    if (!open) {
      setRenameTarget(null);
      setRenameTitle("");
    }
  };

  return (
    <>
      <ScrollArea className="max-h-[70%] w-full overflow-y-auto mt-8 flex-1">
        {isLoading ? (
          <p className=" px-3 text-xs text-muted-foreground">
            Loading threads…
          </p>
        ) : threads.length === 0 ? (
          <p className="px-3 text-xs text-muted-foreground">
            No threads yet. Start a new chat.
          </p>
        ) : (
          <div>
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              Chats
            </p>
               {[...pinnedThreads, ...recentThreads].map((thread) => (
                 <SidebarThreadRow
                   key={thread.id}
                   ref={thread.id === activeThreadId ? activeRowRef : null}
                   thread={thread}
                   isActive={thread.id === activeThreadId}
                   onSelect={() => {
                     clickedIdRef.current = thread.id;
                     onSelectThread(thread.id);
                   }}
                   onTogglePin={() => onTogglePin(thread.id, !thread.pinned)}
                   onRenameRequest={() => {
                     setRenameTarget(thread);
                     setRenameTitle(thread.title);
                   }}
                   onDelete={() => setDeleteTarget(thread)}
                 />
               ))}
            
          </div>
        )}
      </ScrollArea>

      <Dialog open={Boolean(renameTarget)} onOpenChange={handleRenameClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename thread</DialogTitle>
            <DialogDescription>
              Choose a new title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            placeholder="Thread title"
            maxLength={120}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => handleRenameClose(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete thread</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  onDeleteThread(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
