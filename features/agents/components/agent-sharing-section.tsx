'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { XIcon } from 'lucide-react';
import type { SharedUser } from '../types';

type AgentSharingSectionProps = {
  isPublic: boolean;
  onIsPublicChange: (value: boolean) => void;
  onShareSearchChange: (value: string) => void;
  onSharedUserAdd: (user: SharedUser) => void;
  onSharedUserRemove: (userId: string) => void;
  shareSearch: string;
  sharedWith: SharedUser[];
  showNoResults: boolean;
  unaddedResults: SharedUser[];
};

export function AgentSharingSection({
  isPublic,
  onIsPublicChange,
  onShareSearchChange,
  onSharedUserAdd,
  onSharedUserRemove,
  shareSearch,
  sharedWith,
  showNoResults,
  unaddedResults,
}: AgentSharingSectionProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-lg border border-black/5 p-3 dark:border-border">
        <div className="space-y-0.5">
          <Label htmlFor="agent-public" className="cursor-pointer text-sm font-medium">
            Share publicly
          </Label>
          <p className="text-xs text-muted-foreground">
            All users on this platform can see and use this agent.
          </p>
        </div>
        <Switch id="agent-public" checked={isPublic} onCheckedChange={onIsPublicChange} />
      </div>

      <div className="space-y-2">
        <Label>Share with specific people</Label>
        <p className="text-xs text-muted-foreground">
          Search for a registered user by name or email, then click to add them.
        </p>

        {sharedWith.length > 0 && (
          <div className="space-y-1">
            {sharedWith.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5"
              >
                <div className="min-w-0">
                  <span className="text-xs font-medium">{user.name}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{user.email}</span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-6 shrink-0"
                  onClick={() => onSharedUserRemove(user.id)}
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Input
          placeholder="Search by name or email…"
          value={shareSearch}
          onChange={(event) => onShareSearchChange(event.target.value)}
          className="h-8 text-xs"
        />
        {unaddedResults.length > 0 && (
          <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-black/5 p-1 dark:border-border">
            {unaddedResults.map((user) => (
              <button
                key={user.id}
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted/50"
                onClick={() => onSharedUserAdd(user)}
              >
                <span className="text-xs font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </button>
            ))}
          </div>
        )}
        {showNoResults && (
          <p className="px-1 text-xs text-muted-foreground">
            No registered users found for &ldquo;{shareSearch.trim()}&rdquo;. Only users with an existing account can be added.
          </p>
        )}
      </div>
    </div>
  );
}
