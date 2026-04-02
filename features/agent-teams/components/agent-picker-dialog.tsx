'use client';

import { useState, useMemo } from 'react';
import { SearchIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgents } from '@/features/agents/hooks/use-agents';
import type { TeamMemberRole } from '../types';

type AgentPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IDs already in the team — filtered out from picker */
  excludedAgentIds?: string[];
  onSelect: (agentId: string, role: TeamMemberRole) => void;
  isSubmitting?: boolean;
  /** Pre-select a role when the dialog opens (e.g. from a template slot) */
  initialRole?: TeamMemberRole;
};

export function AgentPickerDialog({
  open,
  onOpenChange,
  excludedAgentIds = [],
  onSelect,
  isSubmitting,
  initialRole,
}: AgentPickerDialogProps) {
  const { data, isLoading } = useAgents();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<TeamMemberRole>(initialRole ?? 'specialist');

  const agents = useMemo(() => {
    const all = data?.agents ?? [];
    const filtered = all.filter((a) => !excludedAgentIds.includes(a.id));
    if (!query.trim()) return filtered;
    const q = query.toLowerCase();
    return filtered.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q),
    );
  }, [data?.agents, excludedAgentIds, query]);

  function handleConfirm() {
    if (!selectedId) return;
    onSelect(selectedId, role);
    setSelectedId(null);
    setQuery('');
    setRole('specialist');
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedId(null);
      setQuery('');
      setRole(initialRole ?? 'specialist');
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search agents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Agent list */}
        <ScrollArea className="h-64 rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Loading…
            </div>
          ) : agents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No agents found
            </div>
          ) : (
            <div className="p-1 space-y-0.5">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className={`w-full flex flex-col items-start gap-0.5 rounded px-2.5 py-2 text-left text-sm transition-colors ${
                    selectedId === agent.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedId(agent.id)}
                >
                  <span className="font-medium">{agent.name}</span>
                  {agent.description && (
                    <span
                      className={`text-xs line-clamp-1 ${
                        selectedId === agent.id
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {agent.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Role selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Add as:</span>
          <div className="flex gap-1.5">
            {(['specialist', 'orchestrator'] as TeamMemberRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  role === r
                    ? r === 'orchestrator'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId || isSubmitting}>
            Add member
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
