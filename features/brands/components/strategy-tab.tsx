'use client';

import { useState } from 'react';
import { PlusIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Brand, BrandIcp, BrandIcpInput } from '../types';
import { useIcps, useSaveIcp, useDeleteIcp } from '../hooks/use-brands';
import { ChipInput } from './chip-input';

// ── ICP Dialog ────────────────────────────────────────────────────────────────

const emptyIcp = (): BrandIcpInput => ({
  name: '',
  ageRange: null,
  jobTitles: [],
  painPoints: [],
  buyingTriggers: [],
  objections: [],
  channels: [],
  notes: null,
  sortOrder: 0,
});

function IcpDialog({
  brandId,
  icp,
  open,
  onOpenChange,
}: {
  brandId: string;
  icp: BrandIcp | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState<BrandIcpInput>(() =>
    icp
      ? {
          name: icp.name,
          ageRange: icp.ageRange,
          jobTitles: icp.jobTitles,
          painPoints: icp.painPoints,
          buyingTriggers: icp.buyingTriggers,
          objections: icp.objections,
          channels: icp.channels,
          notes: icp.notes,
          sortOrder: icp.sortOrder,
        }
      : emptyIcp(),
  );
  const saveMutation = useSaveIcp(brandId);
  const set = (patch: Partial<BrandIcpInput>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    saveMutation.mutate(
      { icpId: icp?.id, data: { ...form, name: form.name.trim() } },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{icp ? 'Edit persona' : 'New audience persona'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Persona name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Marketing Manager at mid-market SaaS"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Age range</Label>
              <Input
                value={form.ageRange ?? ''}
                onChange={(e) => set({ ageRange: e.target.value || null })}
                placeholder="e.g. 28–45"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Channels</Label>
              <ChipInput
                values={form.channels}
                onChange={(v) => set({ channels: v })}
                placeholder="LinkedIn, email…"
              />
            </div>
          </div>

          <div>
            <Label>Job titles</Label>
            <p className="mb-1.5 text-xs text-muted-foreground">Press Enter or comma to add</p>
            <ChipInput
              values={form.jobTitles}
              onChange={(v) => set({ jobTitles: v })}
              placeholder="Head of Marketing, CMO…"
            />
          </div>

          <div>
            <Label>Pain points</Label>
            <ChipInput
              values={form.painPoints}
              onChange={(v) => set({ painPoints: v })}
              placeholder="Too much content, not enough leads…"
            />
          </div>

          <div>
            <Label>Buying triggers</Label>
            <ChipInput
              values={form.buyingTriggers}
              onChange={(v) => set({ buyingTriggers: v })}
              placeholder="New budget cycle, competitor switch…"
            />
          </div>

          <div>
            <Label>Objections</Label>
            <ChipInput
              values={form.objections}
              onChange={(v) => set({ objections: v })}
              placeholder="Too expensive, takes too long…"
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes ?? ''}
              onChange={(e) => set({ notes: e.target.value || null })}
              placeholder="Any additional context about this persona"
              rows={2}
              className="mt-1 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save persona'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ICP Card ──────────────────────────────────────────────────────────────────

function IcpCard({
  icp,
  onEdit,
  onDelete,
}: {
  icp: BrandIcp;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-black/5 dark:border-border bg-muted/30 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{icp.name}</p>
        <div className="flex shrink-0 gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={onEdit}>
            <PencilIcon className="size-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2Icon className="size-3" />
          </Button>
        </div>
      </div>

      {(icp.ageRange || icp.channels.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {icp.ageRange && (
            <span className="inline-flex items-center rounded-full bg-background border border-black/5 dark:border-border px-2 py-0.5 text-xs text-muted-foreground">
              {icp.ageRange}
            </span>
          )}
          {icp.channels.map((ch) => (
            <span
              key={ch}
              className="inline-flex items-center rounded-full bg-background border border-black/5 dark:border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              {ch}
            </span>
          ))}
        </div>
      )}

      {icp.painPoints.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Pain points</p>
          <ul className="space-y-0.5">
            {icp.painPoints.slice(0, 3).map((p) => (
              <li key={p} className="text-xs text-foreground/80 before:content-['·'] before:mr-1.5 before:text-muted-foreground">
                {p}
              </li>
            ))}
            {icp.painPoints.length > 3 && (
              <li className="text-xs text-muted-foreground">+{icp.painPoints.length - 3} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Strategy Tab ──────────────────────────────────────────────────────────────

type StrategyFormPatch = {
  positioningStatement?: string;
  messagingPillars?: string[];
  proofPoints?: string[];
  exampleHeadlines?: string[];
  exampleRejections?: string[];
};

type Props = {
  brand: Brand;
  strategyForm: StrategyFormPatch;
  onStrategyChange: (patch: StrategyFormPatch) => void;
};

export function StrategyTab({ brand, strategyForm, onStrategyChange }: Props) {
  const { data: icps = [], isLoading } = useIcps(brand.id);
  const deleteIcp = useDeleteIcp(brand.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIcp, setEditingIcp] = useState<BrandIcp | null>(null);

  const openNew = () => { setEditingIcp(null); setDialogOpen(true); };
  const openEdit = (icp: BrandIcp) => { setEditingIcp(icp); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      {/* Positioning */}
      <div>
        <Label>Positioning statement</Label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          One sentence: who you serve, what you do, and why you&apos;re different.
        </p>
        <Textarea
          value={strategyForm.positioningStatement ?? ''}
          onChange={(e) => onStrategyChange({ positioningStatement: e.target.value })}
          placeholder="e.g. We help marketing managers at B2B SaaS companies produce high-quality content 10× faster without sacrificing brand voice."
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Messaging pillars */}
      <div>
        <Label>Messaging pillars</Label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          3–5 core themes your content always reinforces
        </p>
        <ChipInput
          values={strategyForm.messagingPillars ?? []}
          onChange={(v) => onStrategyChange({ messagingPillars: v })}
          placeholder="Speed, Brand consistency, AI-native…"
        />
      </div>

      {/* Proof points */}
      <div>
        <Label>Proof points</Label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Facts, stats, or achievements that support your pillars
        </p>
        <ChipInput
          values={strategyForm.proofPoints ?? []}
          onChange={(v) => onStrategyChange({ proofPoints: v })}
          placeholder="10× faster content, 98% brand accuracy…"
        />
      </div>

      {/* Example headlines */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>On-brand headline examples</Label>
          <p className="mb-1.5 text-xs text-muted-foreground">Show the AI what good looks like</p>
          <ChipInput
            values={strategyForm.exampleHeadlines ?? []}
            onChange={(v) => onStrategyChange({ exampleHeadlines: v })}
            placeholder="How we 10×&apos;d output without extra headcount…"
          />
        </div>
        <div>
          <Label>Off-brand examples</Label>
          <p className="mb-1.5 text-xs text-muted-foreground">Show what to avoid</p>
          <ChipInput
            values={strategyForm.exampleRejections ?? []}
            onChange={(v) => onStrategyChange({ exampleRejections: v })}
            placeholder="Unlock your potential today…"
          />
        </div>
      </div>

      {/* ICP personas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label>Audience personas (ICP)</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Define who you&apos;re writing for — agents use this to tailor content
            </p>
          </div>
          {brand.isOwner !== false && (
            <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5">
              <PlusIcon className="size-3.5" />
              Add persona
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : icps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 dark:border-border px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No personas yet.</p>
            {brand.isOwner !== false && (
              <Button size="sm" variant="ghost" className="mt-2 gap-1.5" onClick={openNew}>
                <PlusIcon className="size-3.5" />
                Add your first persona
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {icps.map((icp) => (
              <IcpCard
                key={icp.id}
                icp={icp}
                onEdit={() => openEdit(icp)}
                onDelete={() => deleteIcp.mutate(icp.id)}
              />
            ))}
          </div>
        )}
      </div>

      <IcpDialog
        brandId={brand.id}
        icp={editingIcp}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
