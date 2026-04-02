'use client';

import { useState } from 'react';
import { PlusIcon, SaveIcon, Trash2Icon, InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
import type { TeamMemberRole, AgentTeamConfig, RoutingStrategy, TeamMemberSlot } from '../types';

type TeamBuilderPanelProps = {
  team: TeamWithMembers;
  onDeleted?: () => void;
  /** Member slot blueprints from a template — shown until all slots are filled */
  pendingSlots?: TeamMemberSlot[];
};

export function TeamBuilderPanel({ team, onDeleted, pendingSlots: initialPendingSlots }: TeamBuilderPanelProps) {
  const cfg = team.config ?? {};

  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>(
    team.routingStrategy ?? 'sequential',
  );
  const [budgetCredits, setBudgetCredits] = useState<string>(
    cfg.budgetCredits != null ? String(cfg.budgetCredits) : '',
  );
  const [maxSteps, setMaxSteps] = useState<string>(
    cfg.maxSteps != null ? String(cfg.maxSteps) : '',
  );
  const [outputFormat, setOutputFormat] = useState<AgentTeamConfig['outputFormat']>(
    cfg.outputFormat ?? 'markdown',
  );
  const [outputContract, setOutputContract] = useState<AgentTeamConfig['outputContract']>(
    cfg.outputContract ?? 'markdown',
  );
  const [contractSections, setContractSections] = useState<string>(
    (cfg.contractSections ?? []).join(', '),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  // Pending slots from a template — remain until the user assigns an agent to each
  const [pendingSlots, setPendingSlots] = useState<TeamMemberSlot[]>(
    initialPendingSlots ?? [],
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const addMember = useAddTeamMember(team.id);
  const updateMember = useUpdateTeamMember(team.id);
  const removeMember = useRemoveTeamMember(team.id);

  const isDirty =
    name !== team.name ||
    description !== (team.description ?? '') ||
    routingStrategy !== (team.routingStrategy ?? 'sequential') ||
    budgetCredits !== (cfg.budgetCredits != null ? String(cfg.budgetCredits) : '') ||
    maxSteps !== (cfg.maxSteps != null ? String(cfg.maxSteps) : '') ||
    outputFormat !== (cfg.outputFormat ?? 'markdown') ||
    outputContract !== (cfg.outputContract ?? 'markdown') ||
    contractSections !== (cfg.contractSections ?? []).join(', ');

  function buildConfig(): AgentTeamConfig {
    const next: AgentTeamConfig = { outputFormat, outputContract };
    const budget = parseInt(budgetCredits, 10);
    if (!Number.isNaN(budget) && budget > 0) next.budgetCredits = budget;
    const steps = parseInt(maxSteps, 10);
    if (!Number.isNaN(steps) && steps > 0) next.maxSteps = steps;
    if (outputContract === 'sections' && contractSections.trim()) {
      next.contractSections = contractSections
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return next;
  }

  function handleSave() {
    if (!name.trim()) return;
    updateTeam.mutate({
      id: team.id,
      name: name.trim(),
      description: description.trim() || undefined,
      routingStrategy,
      config: buildConfig(),
    });
  }

  function handleDelete() {
    if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return;
    deleteTeam.mutate(team.id, { onSuccess: onDeleted });
  }

  function handleAddMember(agentId: string, role: TeamMemberRole) {
    addMember.mutate({ agentId, role }, { onSuccess: () => setPickerOpen(false) });
  }

  function handleFillSlot(agentId: string, role: TeamMemberRole) {
    if (activeSlotIndex === null) return;
    const slot = pendingSlots[activeSlotIndex];
    if (!slot) return;
    addMember.mutate(
      {
        agentId,
        role,
        displayRole: slot.displayRole,
        tags: slot.tags,
        position: slot.position,
      },
      {
        onSuccess: () => {
          setPendingSlots((prev) => prev.filter((_, i) => i !== activeSlotIndex));
          setActiveSlotIndex(null);
        },
      },
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
    <div className="space-y-6">
      {/* ── Team metadata ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          General
        </p>
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
      </div>

      <Separator />

      {/* ── Run settings ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Run settings
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* Budget */}
          <div className="space-y-1.5">
            <Label htmlFor="budget-credits">
              Credit budget
              <span className="ml-1 text-[10px] text-muted-foreground font-normal">per run</span>
            </Label>
            <Input
              id="budget-credits"
              type="number"
              min={1}
              value={budgetCredits}
              onChange={(e) => setBudgetCredits(e.target.value)}
              placeholder="Unlimited"
            />
          </div>

          {/* Max steps */}
          <div className="space-y-1.5">
            <Label htmlFor="max-steps">
              Max specialist steps
            </Label>
            <Input
              id="max-steps"
              type="number"
              min={1}
              max={10}
              value={maxSteps}
              onChange={(e) => setMaxSteps(e.target.value)}
              placeholder="5 (default)"
            />
          </div>
        </div>

        {/* Output contract */}
        <div className="space-y-1.5">
          <Label htmlFor="output-contract">Output contract</Label>
          <Select
            value={outputContract ?? 'markdown'}
            onValueChange={(v) => setOutputContract(v as AgentTeamConfig['outputContract'])}
          >
            <SelectTrigger id="output-contract">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="markdown">Prose Markdown</SelectItem>
              <SelectItem value="json">Structured JSON</SelectItem>
              <SelectItem value="sections">Named Sections</SelectItem>
            </SelectContent>
          </Select>
          {outputContract === 'sections' && (
            <div className="space-y-1">
              <Input
                placeholder="Summary, Key Findings, Recommendations"
                value={contractSections}
                onChange={(e) => setContractSections(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Comma-separated section names. The orchestrator will structure its output accordingly.
              </p>
            </div>
          )}
        </div>

        {/* Routing strategy */}
        <div className="space-y-1.5">
          <Label htmlFor="routing-strategy">Routing strategy</Label>
          <Select
            value={routingStrategy}
            onValueChange={(v) => setRoutingStrategy(v as RoutingStrategy)}
          >
            <SelectTrigger id="routing-strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sequential">
                Sequential — run all specialists in order
              </SelectItem>
              <SelectItem value="planner_generated">
                AI-planned — orchestrator decides who runs and what they do
              </SelectItem>
            </SelectContent>
          </Select>
          {routingStrategy === 'planner_generated' && (
            <p className="text-[11px] text-muted-foreground">
              The orchestrator will analyze the request first and select which specialists
              to involve, in what order, with targeted sub-prompts. Uses one extra credit
              for the planning step.
            </p>
          )}
        </div>

        {/* Budget hint */}
        {budgetCredits && !Number.isNaN(parseInt(budgetCredits, 10)) && (
          <div className="flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <InfoIcon className="size-3.5 shrink-0 mt-0.5" />
            Run will abort if credits spent reach{' '}
            <strong className="text-foreground">{budgetCredits}</strong>. Check History
            to see past run costs.
          </div>
        )}
      </div>

      <Separator />

      {/* ── Save / Delete ──────────────────────────────────────────────────── */}
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

      <Separator />

      {/* ── Pending template slots ─────────────────────────────────────────── */}
      {pendingSlots.length > 0 && (
        <>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Template slots — assign an agent to each
            </p>
            <div className="space-y-2">
              {pendingSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      slot.role === 'orchestrator'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                    }`}
                  >
                    {slot.displayRole}
                  </span>
                  <span className="flex-1 text-xs text-muted-foreground">{slot.slotHint}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setActiveSlotIndex(idx)}
                  >
                    Assign agent
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* ── Members ───────────────────────────────────────────────────────── */}
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

        {team.members.length === 0 && pendingSlots.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No members yet. Add an orchestrator and at least one specialist.
          </div>
        ) : team.members.length > 0 ? (
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
        ) : null}
      </div>

      {/* Picker for manual "Add member" */}
      <AgentPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludedAgentIds={existingAgentIds}
        onSelect={handleAddMember}
        isSubmitting={addMember.isPending}
      />

      {/* Picker for filling a template slot */}
      {activeSlotIndex !== null && pendingSlots[activeSlotIndex] && (
        <AgentPickerDialog
          open={activeSlotIndex !== null}
          onOpenChange={(open) => { if (!open) setActiveSlotIndex(null); }}
          excludedAgentIds={existingAgentIds}
          onSelect={handleFillSlot}
          isSubmitting={addMember.isPending}
          initialRole={pendingSlots[activeSlotIndex].role}
        />
      )}
    </div>
  );
}
