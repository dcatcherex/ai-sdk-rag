'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { availableModels } from '@/lib/ai';
import { TOOL_REGISTRY } from '@/lib/tool-registry';
import type { Agent, CreateAgentInput } from '../types';

type AgentFormDialogProps = {
  open: boolean;
  agent?: Agent | null;
  onClose: () => void;
  onSubmit: (data: CreateAgentInput) => void;
  isPending?: boolean;
};

export const AgentFormDialog = ({
  open,
  agent,
  onClose,
  onSubmit,
  isPending,
}: AgentFormDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [modelId, setModelId] = useState<string>('auto');
  const [enabledTools, setEnabledTools] = useState<string[]>([]);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description ?? '');
      setSystemPrompt(agent.systemPrompt);
      setModelId(agent.modelId ?? 'auto');
      setEnabledTools(agent.enabledTools ?? []);
    } else {
      setName('');
      setDescription('');
      setSystemPrompt('');
      setModelId('auto');
      setEnabledTools([]);
    }
  }, [agent, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      systemPrompt: systemPrompt.trim(),
      modelId: modelId === 'auto' ? null : modelId,
      enabledTools,
    });
  };

  const toggleTool = (toolId: string) => {
    setEnabledTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  };

  const isValid = name.trim().length > 0 && systemPrompt.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{agent ? 'Edit Agent' : 'Create Agent'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agent-name">Name *</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Code Helper"
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-description">Description</Label>
            <Input
              id="agent-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-prompt">System Prompt *</Label>
            <Textarea
              id="agent-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are an expert..."
              className="min-h-28 resize-none"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Preferred Model</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger>
                <SelectValue placeholder="Auto (recommended)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (recommended)</SelectItem>
                {availableModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tools</Label>
            {Object.entries(TOOL_REGISTRY).map(([id, meta]) => (
              <div key={id} className="flex items-start gap-2">
                <Checkbox
                  id={`tool-${id}`}
                  checked={enabledTools.includes(id)}
                  onCheckedChange={() => toggleTool(id)}
                />
                <div className="space-y-0.5">
                  <label
                    htmlFor={`tool-${id}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {meta.label}
                  </label>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? 'Saving…' : agent ? 'Save changes' : 'Create agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
