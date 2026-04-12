'use client';

import { useState } from 'react';
import { BotIcon, CheckIcon, ChevronsUpDownIcon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { Agent } from '@/features/agents/types';

type AiModeSelectorProps = {
  /** Personal agents filtered to those the user has activated (green dot). */
  agents: Agent[];
  /** Published Essential templates — always shown, used directly (no cloning). */
  essentials: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
};

export const AiModeSelector = ({
  agents,
  essentials,
  selectedAgentId,
  onSelectAgent,
}: AiModeSelectorProps) => {
  const [open, setOpen] = useState(false);

  const allKnown = [...agents, ...essentials];
  const selectedAgent = allKnown.find((a) => a.id === selectedAgentId) ?? null;
  const label = selectedAgent?.name ?? 'General coworker';
  const isDefault = !selectedAgentId;
  const isAgent = !!selectedAgentId;

  const select = (id: string) => { onSelectAgent(id); setOpen(false); };
  const selectGeneral = () => { onSelectAgent(null); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isDefault ? 'ghost' : 'default'}
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
        >
          {isAgent ? (
            <BotIcon className="size-3.5" />
          ) : (
            <SparklesIcon className="size-3.5" />
          )}
          <span className="max-w-[100px] truncate">{label}</span>
          <ChevronsUpDownIcon className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            {/* Default — no agent */}
            <CommandGroup>
              <CommandItem value="general" onSelect={selectGeneral} className="text-xs">
                <SparklesIcon className="size-3.5 mr-1.5 shrink-0" />
                <span>General coworker</span>
                <span className="ml-1.5 text-muted-foreground text-[10px]">best for first-time chat</span>
                {isDefault && <CheckIcon className="ml-auto size-3.5" />}
              </CommandItem>
            </CommandGroup>

            {/* Ready-to-use Essential templates — used directly, no clone created */}
            {essentials.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Ready-to-use">
                  {essentials.map((ess) => (
                    <CommandItem
                      key={ess.id}
                      value={`essential-${ess.id}-${ess.name}`}
                      onSelect={() => select(ess.id)}
                      className="text-xs"
                    >
                      <BotIcon
                        className={cn(
                          'size-3.5 mr-1.5 shrink-0',
                          selectedAgentId === ess.id && 'text-primary',
                        )}
                      />
                      <span className="truncate">{ess.name}</span>
                      {selectedAgentId === ess.id && (
                        <CheckIcon className="ml-auto size-3.5" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Personal agents the user has activated (green dot ON) */}
            {agents.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="My Agents">
                  {agents.map((a) => (
                    <CommandItem
                      key={a.id}
                      value={a.id}
                      onSelect={() => select(a.id)}
                      className="text-xs"
                    >
                      <BotIcon
                        className={cn(
                          'size-3.5 mr-1.5 shrink-0',
                          selectedAgentId === a.id && 'text-primary',
                        )}
                      />
                      <span className="truncate">{a.name}</span>
                      {selectedAgentId === a.id && (
                        <CheckIcon className="ml-auto size-3.5" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
