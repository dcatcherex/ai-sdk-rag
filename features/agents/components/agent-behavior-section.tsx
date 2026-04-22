'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ClipboardCopyIcon, Code2Icon, EyeIcon } from 'lucide-react';
import { MarkdownText } from '@/components/message-renderer/markdown-text';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BrandAccessPolicy, BrandMode, FallbackBehavior } from '@/features/agents/types';
import type { Brand } from '@/features/brands/types';

type AgentBehaviorSectionProps = {
  brandId: string;
  brandMode: BrandMode;
  brandAccessPolicy: BrandAccessPolicy;
  brands: Brand[];
  fallbackBehavior: FallbackBehavior;
  onBrandChange: (value: string) => void;
  onBrandAccessPolicyChange: (value: BrandAccessPolicy) => void;
  onBrandModeChange: (value: BrandMode) => void;
  onFallbackBehaviorChange: (value: FallbackBehavior) => void;
  onRequiresBrandForRunChange: (value: boolean) => void;
  requiresBrandForRun: boolean;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
};

export function AgentBehaviorSection({
  brandId,
  brandMode,
  brandAccessPolicy,
  brands,
  fallbackBehavior,
  onBrandChange,
  onBrandAccessPolicyChange,
  onBrandModeChange,
  onFallbackBehaviorChange,
  onRequiresBrandForRunChange,
  requiresBrandForRun,
  systemPrompt,
  onSystemPromptChange,
}: AgentBehaviorSectionProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canBindSpecificBrand = brands.length > 0;
  const needsBrandPicker = brandMode === 'suggested' || brandMode === 'locked';
  const hasSelectedBrandInList = brandId !== 'none' && brands.some((brand) => brand.id === brandId);

  const chars = systemPrompt.length;
  const lines = systemPrompt.length === 0 ? 0 : systemPrompt.split(/\r?\n/).length;
  const tokens = Math.ceil(systemPrompt.trim().length / 4);

  const copy = async () => {
    await navigator.clipboard.writeText(systemPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (viewMode === 'edit' && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [systemPrompt, viewMode]);

  return (
    <div className="space-y-4">
      {/* Header row: label + stats + toolbar */}
      <div className="flex items-center gap-3">
        <Label className="shrink-0">System Prompt *</Label>
        <span className="text-xs text-muted-foreground">
          {chars} chars · ~{tokens} tokens · {lines} lines
        </span>
        <div className="ml-auto">
          <ButtonGroup className="border rounded-full bg-muted/50 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`size-7 rounded-full ${viewMode === 'preview' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('preview')}
              title="Preview rendered markdown"
            >
              <EyeIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`size-7 rounded-full ${viewMode === 'edit' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setViewMode('edit')}
              title="Edit raw markdown"
            >
              <Code2Icon className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
              onClick={copy}
              title="Copy to clipboard"
            >
              {copied
                ? <CheckIcon className="size-3.5 text-green-500" />
                : <ClipboardCopyIcon className="size-3.5" />}
            </Button>
          </ButtonGroup>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
        <ScrollArea className="h-[32rem]">
          {viewMode === 'edit' ? (
            <textarea
              ref={textareaRef}
              value={systemPrompt}
              onChange={(e) => {
                onSystemPromptChange(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              placeholder="You are an expert..."
              className="w-full min-h-48 resize-none overflow-hidden bg-transparent px-3 py-2 text-sm font-mono leading-6 outline-none placeholder:text-muted-foreground"
              required
            />
          ) : (
            <div className="min-h-48 px-3 py-2 text-sm">
              {systemPrompt.trim()
                ? <MarkdownText content={systemPrompt} />
                : <p className="text-muted-foreground italic text-xs">Nothing to preview yet.</p>}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Brand Mode</Label>
          <Select value={brandMode} onValueChange={(value) => onBrandModeChange(value as BrandMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No brand</SelectItem>
              <SelectItem value="optional">Use selected brand</SelectItem>
              <SelectItem value="suggested" disabled={!canBindSpecificBrand}>Prefer this brand</SelectItem>
              <SelectItem value="locked" disabled={!canBindSpecificBrand}>Lock to this brand</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose whether this agent ignores brand, uses the current brand, or binds to one specific brand.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Fallback Behavior</Label>
          <Select value={fallbackBehavior} onValueChange={(value) => onFallbackBehaviorChange(value as FallbackBehavior)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ask_or_continue">Ask and continue</SelectItem>
              <SelectItem value="ask_to_select">Ask user to select</SelectItem>
              <SelectItem value="block_run">Block run</SelectItem>
              <SelectItem value="use_default">Use default brand</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Brand Access Policy</Label>
        <Select value={brandAccessPolicy} onValueChange={(value) => onBrandAccessPolicyChange(value as BrandAccessPolicy)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no_brand">No brand</SelectItem>
            <SelectItem value="any_accessible">Any accessible brand</SelectItem>
            <SelectItem value="workspace_only">Workspace only</SelectItem>
            <SelectItem value="specific_brand" disabled={!canBindSpecificBrand}>Specific brand</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={requiresBrandForRun}
          onChange={(event) => onRequiresBrandForRunChange(event.target.checked)}
        />
        Require brand for run
      </label>

      {needsBrandPicker && (
        <div className="space-y-1.5">
          <Label>Brand</Label>
          <Select value={brandId} onValueChange={onBrandChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a brand" />
            </SelectTrigger>
            <SelectContent>
              {!hasSelectedBrandInList && brandId !== 'none' ? (
                <SelectItem value={brandId}>
                  Unavailable brand (no current access)
                </SelectItem>
              ) : null}
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-3 shrink-0 rounded-full"
                      style={{ background: brand.colors[0]?.hex ?? 'hsl(var(--muted))' }}
                    />
                    {brand.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {brandMode === 'locked'
              ? 'This agent will always use the selected brand.'
              : 'This brand is suggested by default, but users can override it when allowed.'}
          </p>
          {!hasSelectedBrandInList && brandId !== 'none' ? (
            <p className="text-xs text-amber-600">
              This agent is bound to a brand that is not currently accessible in your brand list. Runtime fallback behavior will apply.
            </p>
          ) : null}
        </div>
      )}

      {!canBindSpecificBrand && (
        <p className="text-xs text-muted-foreground">
          No accessible brands available yet, so only general brand modes can be selected.
        </p>
      )}
    </div>
  );
}
