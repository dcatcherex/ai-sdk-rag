'use client';

import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SharedUser } from '@/features/agents/types';
import type { UserToolShareableWorkspace, UserToolSharedUser, UserToolSharedWorkspace } from '../hooks/use-user-tools';

type ToolSharingSectionProps = {
  shareSearch: string;
  userShareRole: 'runner' | 'editor';
  workspaceShareRole: 'runner' | 'editor';
  selectedWorkspaceId: string;
  sharedWith: UserToolSharedUser[];
  workspaceShares: UserToolSharedWorkspace[];
  shareableWorkspaces: UserToolShareableWorkspace[];
  searchResults: SharedUser[];
  showNoResults: boolean;
  isPending: boolean;
  onShareSearchChange: (value: string) => void;
  onUserShareRoleChange: (value: 'runner' | 'editor') => void;
  onWorkspaceShareRoleChange: (value: 'runner' | 'editor') => void;
  onSelectedWorkspaceChange: (value: string) => void;
  onAdd: (user: SharedUser) => void;
  onRemove: (userId: string) => void;
  onAddWorkspace: () => void;
  onRemoveWorkspace: (brandId: string) => void;
};

export function ToolSharingSection({
  shareSearch,
  userShareRole,
  workspaceShareRole,
  selectedWorkspaceId,
  sharedWith,
  workspaceShares,
  shareableWorkspaces,
  searchResults,
  showNoResults,
  isPending,
  onShareSearchChange,
  onUserShareRoleChange,
  onWorkspaceShareRoleChange,
  onSelectedWorkspaceChange,
  onAdd,
  onRemove,
  onAddWorkspace,
  onRemoveWorkspace,
}: ToolSharingSectionProps) {
  const currentIds = new Set(sharedWith.map((user) => user.id));
  const unaddedResults = searchResults.filter((user) => !currentIds.has(user.id));
  const sharedWorkspaceIds = new Set(workspaceShares.map((workspace) => workspace.brandId));
  const availableWorkspaces = shareableWorkspaces.filter((workspace) => !sharedWorkspaceIds.has(workspace.id));

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Sharing</p>
        <p className="text-xs text-muted-foreground">
          Invite specific people or whole workspaces to run this tool or edit it with you.
        </p>
      </div>

      {workspaceShares.length > 0 ? (
        <div className="space-y-2">
          {workspaceShares.map((workspace) => (
            <div key={workspace.brandId} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{workspace.brandName}</p>
                <p className="truncate text-xs text-muted-foreground">Workspace access</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium uppercase tracking-wide">
                  {workspace.role}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => onRemoveWorkspace(workspace.brandId)}
                  disabled={isPending}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          No workspaces have access yet.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
        <div className="space-y-2">
          <Label htmlFor="tool-workspace-share">Workspace</Label>
          <Select value={selectedWorkspaceId} onValueChange={onSelectedWorkspaceChange}>
            <SelectTrigger id="tool-workspace-share">
              <SelectValue placeholder={availableWorkspaces.length > 0 ? 'Choose workspace' : 'No workspace available'} />
            </SelectTrigger>
            <SelectContent>
              {availableWorkspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tool-workspace-role">Role</Label>
          <Select value={workspaceShareRole} onValueChange={(value) => onWorkspaceShareRoleChange(value as 'runner' | 'editor')}>
            <SelectTrigger id="tool-workspace-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="runner">Runner</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="opacity-0">Add</Label>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onAddWorkspace}
            disabled={isPending || !selectedWorkspaceId}
          >
            Share workspace
          </Button>
        </div>
      </div>

      {sharedWith.length > 0 ? (
        <div className="space-y-2">
          {sharedWith.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium uppercase tracking-wide">
                  {user.role}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => onRemove(user.id)}
                  disabled={isPending}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          No individual shares yet.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
        <div className="space-y-2">
          <Label htmlFor="tool-share-search">Share with</Label>
          <Input
            id="tool-share-search"
            placeholder="Search by name or email..."
            value={shareSearch}
            onChange={(event) => onShareSearchChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tool-share-role">Role</Label>
          <Select value={userShareRole} onValueChange={(value) => onUserShareRoleChange(value as 'runner' | 'editor')}>
            <SelectTrigger id="tool-share-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="runner">Runner</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {unaddedResults.length > 0 ? (
        <div className="max-h-44 overflow-y-auto rounded-lg border">
          {unaddedResults.map((user) => (
            <button
              key={user.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/40"
              onClick={() => onAdd(user)}
              disabled={isPending}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">Add as {userShareRole}</span>
            </button>
          ))}
        </div>
      ) : null}

      {showNoResults ? (
        <p className="text-xs text-muted-foreground">
          No registered users found for &ldquo;{shareSearch.trim()}&rdquo;.
        </p>
      ) : null}
    </div>
  );
}
