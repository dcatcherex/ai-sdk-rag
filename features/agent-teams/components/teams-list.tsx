'use client';

import { useState } from 'react';
import { PlusIcon, UsersIcon, PlayIcon, SettingsIcon, HistoryIcon, LayoutTemplateIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/page-header';
import { TeamBuilderPanel } from './team-builder-panel';
import { TeamChatInterface } from './team-chat-interface';
import { TeamRunHistory } from './team-run-history';
import { TemplatePickerDialog } from './template-picker-dialog';
import { useTeams, useCreateTeam } from '../hooks/use-teams';
import type { TeamWithMembers } from '../hooks/use-teams';
import type { TeamMemberSlot, TeamTemplate } from '../types';

export function TeamsList() {
  const { data, isLoading } = useTeams();
  const createTeam = useCreateTeam();

  const [createOpen, setCreateOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null);
  const [view, setView] = useState<'build' | 'chat' | 'history'>('chat');
  const [pendingSlots, setPendingSlots] = useState<TeamMemberSlot[]>([]);

  const teams = data?.teams ?? [];

  function handleCreate() {
    if (!newName.trim()) return;
    createTeam.mutate(
      { name: newName.trim() },
      {
        onSuccess: (team) => {
          setCreateOpen(false);
          setNewName('');
          setPendingSlots([]);
          setSelectedTeam({ ...team, members: [] });
          setView('build');
        },
      },
    );
  }

  function handleFromTemplate(template: TeamTemplate) {
    createTeam.mutate(
      {
        name: template.name,
        description: template.description,
        routingStrategy: template.routingStrategy,
        config: template.config,
      },
      {
        onSuccess: (team) => {
          setPendingSlots(template.memberSlots);
          setSelectedTeam({ ...team, members: [] });
          setView('build');
        },
      },
    );
  }

  // ── Team detail view ────────────────────────────────────────────────────────

  if (selectedTeam) {
    const fresh = teams.find((t) => t.id === selectedTeam.id) ?? selectedTeam;

    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title={fresh.name}
          description={fresh.description ?? undefined}
          leading={
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-1"
              onClick={() => setSelectedTeam(null)}
            >
              ← Teams
            </Button>
          }
          action={
            <div className="flex gap-1.5">
              <Button
                variant={view === 'chat' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
                onClick={() => setView('chat')}
              >
                <PlayIcon className="size-3.5" />
                Run
              </Button>
              <Button
                variant={view === 'history' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
                onClick={() => setView('history')}
              >
                <HistoryIcon className="size-3.5" />
                History
              </Button>
              <Button
                variant={view === 'build' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
                onClick={() => setView('build')}
              >
                <SettingsIcon className="size-3.5" />
                Configure
              </Button>
            </div>
          }
        />

        <div className="flex-1 overflow-y-auto p-6">
          {view === 'build' ? (
            <TeamBuilderPanel
              team={fresh}
              onDeleted={() => setSelectedTeam(null)}
              pendingSlots={pendingSlots}
            />
          ) : view === 'history' ? (
            <TeamRunHistory teamId={fresh.id} />
          ) : (
            <TeamChatInterface
              teamId={fresh.id}
              teamName={fresh.name}
              routingStrategy={fresh.routingStrategy ?? 'sequential'}
              outputContract={fresh.config?.outputContract}
              contractSections={fresh.config?.contractSections}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Teams list ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Agent Teams"
        description="Coordinate multiple agents to tackle complex workflows"
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setTemplatePickerOpen(true)}
            >
              <LayoutTemplateIcon className="size-4" />
              From template
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              New team
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading teams…</p>
        ) : teams.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <UsersIcon className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No teams yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a team to run coordinated multi-agent workflows.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTemplatePickerOpen(true)}>
                <LayoutTemplateIcon className="size-4" />
                From template
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" />
                New team
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                className="rounded-lg border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setSelectedTeam(team);
                  setView('chat');
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{team.name}</p>
                    {team.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {team.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground mt-0.5">
                    {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {team.members.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {team.members.slice(0, 4).map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {m.agentName}
                      </span>
                    ))}
                    {team.members.length > 4 && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        +{team.members.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Template picker */}
      <TemplatePickerDialog
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={handleFromTemplate}
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New agent team</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-team-name">Team name</Label>
              <Input
                id="new-team-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Marketing Campaign Team"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || createTeam.isPending}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
