'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ClipboardCopyIcon, Code2Icon, EyeIcon } from 'lucide-react';
import { MarkdownText } from '@/components/message-renderer/markdown-text';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

type AgentBehaviorSectionProps = {
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
};

export function AgentBehaviorSection({ systemPrompt, onSystemPromptChange }: AgentBehaviorSectionProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chars = systemPrompt.length;
  const lines = systemPrompt.length === 0 ? 0 : systemPrompt.split(/\r?\n/).length;
  const tokens = Math.ceil(systemPrompt.trim().length / 4);

  const copy = async () => {
    await navigator.clipboard.writeText(systemPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-grow textarea so ScrollArea handles scrolling
  useEffect(() => {
    if (viewMode === 'edit' && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [systemPrompt, viewMode]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>System Prompt *</Label>
        <span className="text-xs text-muted-foreground">
          {chars} chars · ~{tokens} tokens · {lines} lines
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Write the agent&apos;s instructions in markdown. The agent follows these on every message.
      </p>
      <div className="relative rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
        {/* Toolbar */}
        <div className="absolute top-2 right-2 z-10">
          <ButtonGroup className="border rounded-full bg-background/90 backdrop-blur-sm shadow-sm">
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
              className="w-full min-h-48 resize-none overflow-hidden bg-transparent px-3 py-2 pr-32 text-sm font-mono leading-6 outline-none placeholder:text-muted-foreground"
              required
            />
          ) : (
            <div className="min-h-48 px-3 py-2 pr-32 text-sm">
              {systemPrompt.trim()
                ? <MarkdownText content={systemPrompt} />
                : <p className="text-muted-foreground italic text-xs">Nothing to preview yet.</p>}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
