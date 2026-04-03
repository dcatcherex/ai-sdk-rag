'use client';

import { useState } from 'react';
import { PencilIcon, TrashIcon, PlusIcon, ShieldCheckIcon } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useGuardrails, useSaveGuardrail, useDeleteGuardrail } from '../hooks/use-guardrails';
import type { BrandGuardrail, GuardrailRuleType, GuardrailSeverity } from '../types';
import type { CreateGuardrailInput } from '../schema';

type GuardrailForm = {
  id?: string;
  ruleType: GuardrailRuleType;
  title: string;
  description: string;
  pattern: string;
  severity: GuardrailSeverity;
  isActive: boolean;
};

const EMPTY_FORM: GuardrailForm = {
  ruleType: 'tone_rule',
  title: '',
  description: '',
  pattern: '',
  severity: 'warning',
  isActive: true,
};

const RULE_TYPE_LABELS: Record<GuardrailRuleType, string> = {
  banned_phrase: 'Banned Phrase',
  tone_rule: 'Tone Rule',
  compliance_note: 'Compliance Note',
  required_disclosure: 'Required Disclosure',
};

const SEVERITY_VARIANTS: Record<GuardrailSeverity, 'destructive' | 'default' | 'secondary'> = {
  block: 'destructive',
  warning: 'default',
  info: 'secondary',
};

export function GuardrailEditor({ brandId }: { brandId: string }) {
  const { data: guardrails = [], isLoading } = useGuardrails(brandId);
  const saveMutation = useSaveGuardrail(brandId);
  const deleteMutation = useDeleteGuardrail(brandId);

  const [form, setForm] = useState<GuardrailForm>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);

  const set = (patch: Partial<GuardrailForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleEdit = (g: BrandGuardrail) => {
    setForm({
      id: g.id,
      ruleType: g.ruleType,
      title: g.title,
      description: g.description ?? '',
      pattern: g.pattern ?? '',
      severity: g.severity,
      isActive: g.isActive,
    });
    setEditing(true);
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setEditing(false);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    const payload: CreateGuardrailInput & { id?: string } = {
      id: form.id,
      ruleType: form.ruleType,
      title: form.title.trim(),
      description: form.description.trim() || null,
      pattern: form.pattern.trim() || null,
      severity: form.severity,
      isActive: form.isActive,
    };
    saveMutation.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setEditing(false);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Brand Guardrails</h3>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <PlusIcon className="size-3.5 mr-1" />
            Add Rule
          </Button>
        )}
      </div>

      {/* Rule list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (guardrails as BrandGuardrail[]).length === 0 && !editing ? (
        <p className="text-xs text-muted-foreground italic">
          No guardrail rules yet. Add rules to enforce brand tone, banned phrases, and compliance requirements.
        </p>
      ) : (
        <div className="space-y-2">
          {(guardrails as BrandGuardrail[]).map((g) => (
            <div
              key={g.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-black/5 dark:border-border bg-muted/30 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-medium">{g.title}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {RULE_TYPE_LABELS[g.ruleType]}
                  </Badge>
                  <Badge
                    variant={SEVERITY_VARIANTS[g.severity]}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {g.severity}
                  </Badge>
                  {!g.isActive && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                      inactive
                    </Badge>
                  )}
                </div>
                {g.description && (
                  <p className="text-xs text-muted-foreground truncate">{g.description}</p>
                )}
                {g.pattern && (
                  <p className="text-xs text-muted-foreground font-mono">/{g.pattern}/</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => handleEdit(g)}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(g.id)}
                  disabled={deleteMutation.isPending}
                >
                  <TrashIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {editing && (
        <div className="rounded-lg border border-black/10 dark:border-border p-4 space-y-3 bg-background">
          <p className="text-sm font-medium">{form.id ? 'Edit Rule' : 'New Rule'}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Rule Type</Label>
              <Select
                value={form.ruleType}
                onValueChange={(v) => set({ ruleType: v as GuardrailRuleType })}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RULE_TYPE_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Severity</Label>
              <Select
                value={form.severity}
                onValueChange={(v) => set({ severity: v as GuardrailSeverity })}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">Block</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. No competitor mentions"
              className="mt-1 h-8 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Explain when and why this rule applies…"
              rows={2}
              className="mt-1 resize-none text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">Pattern (regex or exact phrase)</Label>
            <Input
              value={form.pattern}
              onChange={(e) => set({ pattern: e.target.value })}
              placeholder="e.g. competitor|rival brand"
              className="mt-1 h-8 text-sm font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="guardrail-active"
              checked={form.isActive}
              onCheckedChange={(v) => set({ isActive: v })}
            />
            <Label htmlFor="guardrail-active" className="text-xs">Active</Label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending || !form.title.trim()}
            >
              {saveMutation.isPending ? 'Saving…' : form.id ? 'Update' : 'Add Rule'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
