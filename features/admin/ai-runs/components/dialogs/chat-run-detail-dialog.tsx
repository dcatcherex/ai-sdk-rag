'use client';

import { Loader2Icon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ErrorCard, JsonBlock, TokenValue } from '../shared';
import type { AdminChatRunDetail } from '../../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: AdminChatRunDetail | undefined;
  isLoading: boolean;
};

export function ChatRunDetailDialog({ open, onOpenChange, detail, isLoading }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl">
        <DialogHeader>
          <DialogTitle>Chat Run Detail</DialogTitle>
          <DialogDescription>
            Request-level execution data for the selected main chat run.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !detail ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading run detail...
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Run</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div>ID: {detail.id}</div>
                    <div>Status: <span className="capitalize">{detail.status}</span></div>
                    <div>Route: <span className="capitalize">{detail.routeKind}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">User</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div>{detail.userName || 'Unknown user'}</div>
                    <div>{detail.userEmail || detail.userId}</div>
                    <div>Thread {detail.threadId}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Usage</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div>Prompt: <TokenValue value={detail.promptTokens} /></div>
                    <div>Completion: <TokenValue value={detail.completionTokens} /></div>
                    <div>Total: <TokenValue value={detail.totalTokens} /></div>
                    <div>Credits: {detail.creditCost ?? '—'}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Input Summary</div>
                  <JsonBlock value={detail.inputJson} />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Output Summary</div>
                  <JsonBlock value={detail.outputJson} />
                </div>
              </div>

              {detail.errorMessage && <ErrorCard message={detail.errorMessage} />}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
