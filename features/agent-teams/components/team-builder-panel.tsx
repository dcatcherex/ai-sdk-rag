'use client';

import { useState } from 'react';
import { PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TeamMemberRow } from './team-member-row';
import { AgentPickerDialog } from './agent-picker-dialog';
import {
  useUpdateTeam,
  useDeleteTeam,
  useAddTeamMember,
  useUpdateTeamMember,
  useRemoveTeamMember,
} from '../hooks/use-teams';
import type { TeamWithMembers } from '../hooks/use-teams';
import type { TeamMemberRole } from '../types';

type TeamBuilderPanelProps = {
  team: TeamWithMembers;
  onDeleted?: () => void;
};

export function TeamBuilderPanel({ team, onDeleted }: TeamBuilderPanelProps) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);

  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const addMember = useAddTeamMember(team.id);
  const updateMember = useUpdateTeamMember(team.id);
  const removeMember = useRemoveTeamMember(team.id);

  const isDirty = name !== team.name || description !== (team.description ?? '');

  function handleSave() {
    if (!name.trim()) return;
    updateTeam.mutate({ id: team.id, name: name.trim(), description: description.trim() || undefined });
  }

  function handleDelete() {
    if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return;
    deleteTeam.mutate(team.id, { onSuccess: onDeleted });
  }

  function handleAddMember(agentId: string, role: TeamMemberRole) {
    addMember.mutate(
      { agentId, role },
      { onSuccess: () => setPickerOpen(false) },
    );
  }

  function handleMoveUp(memberId: string, position: number) {
    if (position === 0) return;
    const above = team.members.find((m) => m.position === position - 1);
    if (!above) return;
    updateMember.mutate({ memberId, position: position - 1 });
    updateMember.mutate({ memberId: above.id, position });
  }

  function handleMoveDown(memberId: string, position: number) {
    if (position >= team.members.length - 1) return;
    const below = team.members.find((m) => m.position === position + 1);
    if (!below) return;
    updateMember.mutate({ memberId, position: position + 1 });
    updateMember.mutate({ memberId: below.id, position });
  }

  const existingAgentIds = team.members.map((m) => m.agentId);

  return (
    <div className="space-y-5">
      {/* Team metadata */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="team-name">Team name</Label>
          <Input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marketing Campaign Team"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-desc">Description</Label>
          <Textarea
            id="team-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this team do?"
            rows={2}
            className="resize-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || !name.trim() || updateTeam.isPending}
            className="gap-1.5"
          >
            <SaveIcon className="size-3.5" />
            Save
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteTeam.isPending}
            className="gap-1.5 ml-auto"
          >
            <Trash2Icon className="size-3.5" />
            Delete team
          </Button>
        </div>
      </div>

      {/* Members */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Members ({team.members.length})</p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs"
            onClick={() => setPickerOpen(true)}
          >
            <PlusIcon className="size-3" />
            Add member
          </Button>
        </div>

        {team.members.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No members yet. Add an orchestrator and at least one specialist.
          </div>
        ) : (
          <div className="space-y-2">
            {[...team.members]
              .sort((a, b) => a.position - b.position)
              .map((member, idx, arr) => (
                <div key={member.id} className="group">
                  <TeamMemberRow
                    member={member}
                    isFirst={idx === 0}
                    isLast={idx === arr.length - 1}
                    onMoveUp={() => handleMoveUp(member.id, member.position)}
                    onMoveDown={() => handleMoveDown(member.id, member.position)}
                    onDelete={() => removeMember.mutate(member.id)}
                    onUpdateDisplayRole={(displayRole) =>
                      updateMember.mutate({ memberId: member.id, displayRole })
                    }
                    isDeleting={removeMember.isPending}
                    isUpdating={updateMember.isPending}
                  />
                </div>
              ))}
          </div>
        )}
      </div>

      <AgentPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludedAgentIds={existingAgentIds}
        onSelect={handleAddMember}
        isSubmitting={addMember.isPending}
      />
    </div>
  );
}
