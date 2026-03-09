import { WrenchIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { TOOL_REGISTRY, ALL_TOOL_IDS, type ToolId } from '@/lib/tool-registry';

const TOOL_GROUPS = ['utilities', 'knowledge', 'productivity'] as const;
const GROUP_LABELS: Record<string, string> = {
  utilities: 'Utilities',
  knowledge: 'Knowledge',
  productivity: 'Productivity',
};

type Props = {
  effectiveToolIds: string[];
  onToggleTool: (toolId: ToolId, enabled: boolean) => Promise<void>;
};

export function ToolsSection({ effectiveToolIds, onToggleTool }: Props) {
  return (
    <section className="border-t border-black/5 dark:border-white/10 pt-6">
      <div className="flex items-center gap-2 mb-1">
        <WrenchIcon className="size-5 text-muted-foreground" />
        <h3 className="text-base font-semibold">AI Tools</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Choose which tools the AI can use during chat. Disabling tools reduces token usage and keeps the AI focused.
      </p>

      {TOOL_GROUPS.map((group) => {
        const groupTools = ALL_TOOL_IDS.filter((id) => TOOL_REGISTRY[id].group === group);
        if (groupTools.length === 0) return null;
        return (
          <div key={group} className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{GROUP_LABELS[group]}</p>
            <div className="space-y-2">
              {groupTools.map((toolId) => {
                const entry = TOOL_REGISTRY[toolId];
                const isEnabled = effectiveToolIds.includes(toolId);
                return (
                  <div key={toolId} className="flex items-start justify-between gap-4 rounded-lg border border-black/5 dark:border-white/10 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(v) => void onToggleTool(toolId as ToolId, v)}
                      className="shrink-0 mt-0.5"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
