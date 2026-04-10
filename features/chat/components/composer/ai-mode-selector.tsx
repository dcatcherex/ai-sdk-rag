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
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
};

export const AiModeSelector = ({
  agents,
  selectedAgentId,
  onSelectAgent,
}: AiModeSelectorProps) => {
  const [open, setOpen] = useState(false);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  const label = selectedAgent?.name ?? 'General';

  const isDefault = !selectedAgentId;
  const isAgent = !!selectedAgentId;

  const handleSelectAgent = (id: string) => {
    onSelectAgent(id);
    setOpen(false);
  };

  const handleSelectGeneral = () => {
    onSelectAgent(null);
    setOpen(false);
  };

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

            {/* Default general agent */}
            <CommandGroup>
              <CommandItem
                value="general"
                onSelect={handleSelectGeneral}
                className="text-xs"
              >
                <SparklesIcon className="size-3.5 mr-1.5 shrink-0" />
                <span>General</span>
                <span className="ml-1.5 text-muted-foreground text-[10px]">auto-detect style</span>
                {isDefault && <CheckIcon className="ml-auto size-3.5" />}
              </CommandItem>
            </CommandGroup>

            {/* Custom agents */}
            {agents.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="My Agents">
                  {agents.map((agent) => (
                    <CommandItem
                      key={agent.id}
                      value={agent.id}
                      onSelect={() => handleSelectAgent(agent.id)}
                      className="text-xs"
                    >
                      <BotIcon
                        className={cn(
                          'size-3.5 mr-1.5 shrink-0',
                          selectedAgentId === agent.id && 'text-primary',
                        )}
                      />
                      <span className="truncate">{agent.name}</span>
                      {selectedAgentId === agent.id && (
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
