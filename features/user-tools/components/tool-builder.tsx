'use client';

import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AiAssistButton } from '@/features/workspace-ai/components/ai-assist-button';
import { AiSuggestionDialog } from '@/features/workspace-ai/components/ai-suggestion-dialog';
import { requestWorkspaceTextAssist } from '@/features/workspace-ai/client';
import type { UserToolDetail } from '../hooks/use-user-tools';

type ToolBuilderProps = {
  form: {
    name: string;
    slug: string;
    description: string;
    category: string;
    executionType: 'webhook' | 'workflow';
    readOnly: boolean;
    requiresConfirmation: boolean;
    supportsAgent: boolean;
    supportsManualRun: boolean;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    webhookUrl: string;
    inputSchemaText: string;
    outputSchemaText: string;
    requestTemplateText: string;
    workflowStepsText: string;
  };
  selectedTool: UserToolDetail | null;
  isPending: boolean;
  onChange: (patch: Partial<ToolBuilderProps['form']>) => void;
  onCreate: () => void;
  onSave: () => void;
  onLoadFromTool: (tool: UserToolDetail) => void;
};

export function ToolBuilder({
  form,
  selectedTool,
  isPending,
  onChange,
  onCreate,
  onSave,
  onLoadFromTool,
}: ToolBuilderProps) {
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([]);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);

  async function handleGenerateDescription() {
    setIsGeneratingDescription(true);
    try {
      const result = await requestWorkspaceTextAssist('tool-description', {
        targetLocale: 'th',
        context: {
          entityType: 'tool',
          name: form.name || undefined,
          currentValue: form.description || undefined,
          extra: { executionType: form.executionType },
        },
      });
      setDescriptionSuggestions(result.suggestions);
      setDescriptionDialogOpen(true);
    } catch {
      // silently fail — user can retry
    } finally {
      setIsGeneratingDescription(false);
    }
  }

  return (
    <div className="space-y-5">
      {selectedTool ? (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{selectedTool.tool.name}</p>
            <p className="text-xs text-muted-foreground">
              Active version {selectedTool.activeVersion?.version ?? 'none'} · {selectedTool.tool.executionType}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onLoadFromTool(selectedTool)}>
            Load into editor
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="tool-name">Tool name</Label>
          <Input id="tool-name" value={form.name} onChange={(event) => onChange({ name: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tool-slug">Slug</Label>
          <Input id="tool-slug" value={form.slug} onChange={(event) => onChange({ slug: event.target.value })} />
        </div>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="tool-category">Category</Label>
          <Input id="tool-category" value={form.category} onChange={(event) => onChange({ category: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tool-execution-type">Execution type</Label>
          <Select
            value={form.executionType}
            onValueChange={(value) => onChange({ executionType: value as ToolBuilderProps['form']['executionType'] })}
          >
            <SelectTrigger id="tool-execution-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="webhook">Webhook</SelectItem>
              <SelectItem value="workflow">Workflow</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="tool-description">Description</Label>
          <AiAssistButton
            onClick={handleGenerateDescription}
            isLoading={isGeneratingDescription}
            idleLabel="Generate"
            loadingLabel="Generating…"
          />
        </div>
        <Textarea
          id="tool-description"
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={3}
        />
      </div>

      <AiSuggestionDialog
        open={descriptionDialogOpen}
        onOpenChange={setDescriptionDialogOpen}
        title="Description suggestions"
        description="Pick a description for this tool."
        suggestions={descriptionSuggestions}
        onSelect={(suggestion) => {
          onChange({ description: suggestion });
          setDescriptionDialogOpen(false);
        }}
      />

      {form.executionType === 'webhook' ? (
        <>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="tool-method">Webhook method</Label>
              <Select value={form.method} onValueChange={(value) => onChange({ method: value as ToolBuilderProps['form']['method'] })}>
                <SelectTrigger id="tool-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://example.com/api/run-tool"
                value={form.webhookUrl}
                onChange={(event) => onChange({ webhookUrl: event.target.value })}
              />
            </div>
          </div>
        </>
      ) : null}

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="input-schema">Input schema JSON</Label>
          <Textarea
            id="input-schema"
            value={form.inputSchemaText}
            onChange={(event) => onChange({ inputSchemaText: event.target.value })}
            rows={12}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="output-schema">Output schema JSON</Label>
          <Textarea
            id="output-schema"
            value={form.outputSchemaText}
            onChange={(event) => onChange({ outputSchemaText: event.target.value })}
            rows={12}
            className="font-mono text-xs"
          />
        </div>
      </div>

      {form.executionType === 'webhook' ? (
        <div className="space-y-2">
          <Label htmlFor="request-template">Request template JSON</Label>
          <Textarea
            id="request-template"
            value={form.requestTemplateText}
            onChange={(event) => onChange({ requestTemplateText: event.target.value })}
            rows={8}
            className="font-mono text-xs"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="workflow-steps">Workflow steps JSON</Label>
          <Textarea
            id="workflow-steps"
            value={form.workflowStepsText}
            onChange={(event) => onChange({ workflowStepsText: event.target.value })}
            rows={12}
            className="font-mono text-xs"
          />
        </div>
      )}

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Read only</p>
            <p className="text-xs text-muted-foreground">Disable confirmation for pure lookups.</p>
          </div>
          <Switch checked={form.readOnly} onCheckedChange={(value) => onChange({ readOnly: value })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Requires confirmation</p>
            <p className="text-xs text-muted-foreground">Force approval before side effects.</p>
          </div>
          <Switch checked={form.requiresConfirmation} onCheckedChange={(value) => onChange({ requiresConfirmation: value })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Available to agents</p>
            <p className="text-xs text-muted-foreground">Lets attached agents call this tool in chat.</p>
          </div>
          <Switch checked={form.supportsAgent} onCheckedChange={(value) => onChange({ supportsAgent: value })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Available for manual runs</p>
            <p className="text-xs text-muted-foreground">Keeps the builder test and run surface active.</p>
          </div>
          <Switch checked={form.supportsManualRun} onCheckedChange={(value) => onChange({ supportsManualRun: value })} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {selectedTool ? (
          <Button type="button" variant="outline" onClick={onSave} disabled={isPending} className="gap-2">
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Save new version
          </Button>
        ) : null}
        <Button type="button" onClick={onCreate} disabled={isPending} className="gap-2">
          {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {selectedTool ? 'Clone as new tool' : 'Create tool'}
        </Button>
      </div>
    </div>
  );
}
