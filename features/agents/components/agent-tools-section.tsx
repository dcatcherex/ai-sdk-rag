'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TOOL_REGISTRY } from '@/lib/tool-registry';

type AgentToolsSectionProps = {
  enabledTools: string[];
  onToggleTool: (toolId: string) => void;
};

export function AgentToolsSection({ enabledTools, onToggleTool }: AgentToolsSectionProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Tools</Label>
        <p className="text-sm text-muted-foreground">
          Choose which capabilities this agent is allowed to use while helping users.
        </p>
        <div className="space-y-2 rounded-lg border border-black/5 bg-background p-3 dark:border-border">
          {Object.entries(TOOL_REGISTRY).map(([id, meta]) => (
            <div key={id} className="flex items-start gap-2">
              <Checkbox
                id={`tool-${id}`}
                checked={enabledTools.includes(id)}
                onCheckedChange={() => onToggleTool(id)}
              />
              <div className="space-y-0.5">
                <label htmlFor={`tool-${id}`} className="cursor-pointer text-sm font-medium leading-none">
                  {meta.label}
                </label>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
