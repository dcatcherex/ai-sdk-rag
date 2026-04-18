'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BlocksIcon, ChevronDownIcon, ChevronRightIcon, EyeIcon, Loader2Icon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type Block = {
  label: string;
  content: string;
  tokens: number;
  note?: string;
};

type ToolEntry = { id: string; title: string };

type PreviewResult = {
  assembled: string;
  estimatedTokens: number;
  activatedSkillCount: number;
  activatedSkillNames: string[];
  attachedSkillCount: number;
  attachedSkillNames: string[];
  activeTools: ToolEntry[];
  blocks: Block[];
};

type AgentPromptPreviewSectionProps = {
  agentId: string | undefined;
  skillIds: string[];
  enabledTools: string[];
};

function CollapsibleBlock({ block }: { block: Block }) {
  const [open, setOpen] = useState(block.label === 'System Prompt');
  return (
    <div className="rounded-lg border bg-muted/30">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDownIcon className="size-3.5 shrink-0" /> : <ChevronRightIcon className="size-3.5 shrink-0" />}
        <span className="flex-1 text-left">{block.label}</span>
        {block.tokens > 0
          ? <Badge variant="secondary" className="font-mono text-xs">~{block.tokens} tk</Badge>
          : <Badge variant="outline" className="text-xs text-muted-foreground">not in prompt</Badge>
        }
      </button>
      {open && (
        <>
          {block.note && (
            <p className="border-t px-3 py-1.5 text-xs text-muted-foreground italic">{block.note}</p>
          )}
          <pre className="border-t px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground max-h-64 overflow-y-auto">
            {block.content}
          </pre>
        </>
      )}
    </div>
  );
}

const DEBOUNCE_MS = 800;

export function AgentPromptPreviewSection({ agentId, skillIds, enabledTools }: AgentPromptPreviewSectionProps) {
  const [testMessage, setTestMessage] = useState('');
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track what the last fetch used so we skip identical re-fetches
  const lastFetchKeyRef = useRef<string>('');

  const fetchPreview = useCallback(async (msg: string, isBackground: boolean) => {
    if (!agentId) return;
    const key = JSON.stringify({ msg, skillIds, enabledTools });
    if (key === lastFetchKeyRef.current) return;
    lastFetchKeyRef.current = key;

    if (isBackground) setRefreshing(true);
    else { setLoading(true); setError(''); }

    try {
      const res = await fetch(`/api/agents/${agentId}/preview-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMessage: msg.trim() || undefined,
          skillIds,
          enabledTools,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json() as PreviewResult);
      setError('');
    } catch (err) {
      if (!isBackground) setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      if (isBackground) setRefreshing(false);
      else setLoading(false);
    }
  }, [agentId, skillIds, enabledTools]);

  // Auto-run on first mount
  useEffect(() => {
    if (!agentId) return;
    void fetchPreview(testMessage, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Debounced background refresh when skills/tools change
  useEffect(() => {
    if (!agentId || !result) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchPreview(testMessage, true);
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillIds.join(','), enabledTools.join(',')]);

  const handlePreview = () => { void fetchPreview(testMessage, false); };

  return (
    <div className="space-y-4">
      {/* Live state summary */}
      <div className="rounded-lg border bg-muted/30 divide-y text-sm">
        <div className="flex items-center gap-2 px-3 py-2">
          <SparklesIcon className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Skills attached:</span>
          {skillIds.length === 0 ? (
            <span className="text-muted-foreground italic">none</span>
          ) : (
            <span className="font-medium">{skillIds.length} skill{skillIds.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <BlocksIcon className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Tools enabled:</span>
          {enabledTools.length === 0 ? (
            <span className="text-muted-foreground italic">all tools</span>
          ) : (
            <span className="font-medium">{enabledTools.length} tool{enabledTools.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Test message (optional)</label>
        <p className="text-xs text-muted-foreground">
          Enter a sample user message to see which skills activate and what gets injected.
        </p>
        <Textarea
          placeholder="e.g. Write a LINE post for our new product launch…"
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          rows={3}
          className="resize-none font-mono text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handlePreview} disabled={loading || !agentId} className="gap-2">
          <EyeIcon className="size-4" />
          {loading ? 'Building preview…' : 'Preview prompt'}
        </Button>
        {refreshing && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            Updating…
          </span>
        )}
      </div>

      {!agentId && (
        <p className="text-xs text-amber-600">Save the agent before previewing.</p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <div>
                <span className="font-semibold">~{result.estimatedTokens.toLocaleString()}</span>
                <span className="text-muted-foreground"> estimated tokens</span>
              </div>
              {result.activatedSkillCount > 0 && (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <SparklesIcon className="size-3.5" />
                  <span>{result.activatedSkillCount} skill{result.activatedSkillCount !== 1 ? 's' : ''} activated</span>
                </div>
              )}
            </div>
            {result.attachedSkillCount > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.attachedSkillNames.map((name) => (
                  <Badge
                    key={name}
                    variant={result.activatedSkillNames.includes(name) ? 'default' : 'secondary'}
                    className="text-xs gap-1"
                  >
                    <SparklesIcon className="size-2.5" />
                    {name}
                    {result.activatedSkillNames.includes(name) && ' ✓'}
                  </Badge>
                ))}
              </div>
            )}
            {result.activeTools.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.activeTools.map((t) => (
                  <Badge key={t.id} variant="outline" className="text-xs gap-1">
                    <BlocksIcon className="size-2.5" />
                    {t.title}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {result.blocks.map((block) => (
              <CollapsibleBlock key={block.label} block={block} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
