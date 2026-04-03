'use client';

import { useState } from 'react';
import { UserPlusIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useWorkspaceMembers,
  useAddWorkspaceMember,
  useUpdateMemberRole,
  useRemoveWorkspaceMember,
} from '../hooks/use-collaboration';
import type { WorkspaceMember, WorkspaceMemberRole } from '../types';

type Props = {
  brandId: string;
};

const ROLE_LABELS: Record<WorkspaceMemberRole, string> = {
  admin: 'Admin',
  writer: 'Writer',
  editor: 'Editor',
  reviewer: 'Reviewer',
};

export function WorkspaceMembersPanel({ brandId }: Props) {
  const { data: members = [], isLoading } = useWorkspaceMembers(brandId);
  const addMutation = useAddWorkspaceMember(brandId);
  const updateRoleMutation = useUpdateMemberRole(brandId);
  const removeMutation = useRemoveWorkspaceMember(brandId);

  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>('writer');

  const handleInvite = () => {
    if (!inviteUserId.trim()) return;
    addMutation.mutate(
      { userId: inviteUserId.trim(), role: inviteRole },
      {
        onSuccess: () => {
          setInviteUserId('');
          setInviteRole('writer');
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UsersIcon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Workspace Members</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Manage team members who can collaborate on content for this brand.
      </p>

      {/* Member list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (members as WorkspaceMember[]).length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No workspace members yet. Invite team members below.
        </p>
      ) : (
        <div className="space-y-1.5">
          {(members as WorkspaceMember[]).map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-black/5 dark:border-border bg-muted/30 px-3 py-2"
            >
              <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                {(m.userName ?? m.userEmail ?? '?')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{m.userName ?? m.userEmail}</p>
                {m.userName && (
                  <p className="text-xs text-muted-foreground truncate">{m.userEmail}</p>
                )}
              </div>
              <Select
                value={m.role}
                onValueChange={(v) =>
                  updateRoleMutation.mutate({ userId: m.userId, role: v as WorkspaceMemberRole })
                }
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as WorkspaceMemberRole[]).map((role) => (
                    <SelectItem key={role} value={role} className="text-xs">
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeMutation.mutate(m.userId)}
                disabled={removeMutation.isPending}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      <div className="rounded-lg border border-black/10 dark:border-border p-3 space-y-3 bg-background">
        <p className="text-xs font-medium">Invite Member</p>
        <div>
          <Label className="text-xs">User ID or Email</Label>
          <Input
            value={inviteUserId}
            onChange={(e) => setInviteUserId(e.target.value)}
            placeholder="Enter user ID…"
            className="mt-1 h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Role</Label>
          <Select
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as WorkspaceMemberRole)}
          >
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABELS) as WorkspaceMemberRole[]).map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleInvite}
          disabled={addMutation.isPending || !inviteUserId.trim()}
        >
          <UserPlusIcon className="size-3.5 mr-1" />
          {addMutation.isPending ? 'Inviting…' : 'Invite'}
        </Button>
      </div>
    </div>
  );
}
