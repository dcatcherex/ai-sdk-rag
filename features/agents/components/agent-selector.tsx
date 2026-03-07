'use client';

import { useState } from 'react';
import { BotIcon, CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
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
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { Agent } from '../types';

type AgentSelectorProps = {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
};

export const AgentSelector = ({
  agents,
  selectedAgentId,
  onSelectAgent,
}: AgentSelectorProps) => {
  const [open, setOpen] = useState(false);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  const handleSelect = (id: string | null) => {
    onSelectAgent(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={selectedAgentId ? 'default' : 'ghost'}
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
        >
          <BotIcon className="size-3.5" />
          <span className="max-w-[100px] truncate">
            {selectedAgent?.name ?? 'Agent'}
          </span>
          <ChevronsUpDownIcon className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search agents…" className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No agents found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => handleSelect(null)}
                className="text-xs"
              >
                <span className="text-muted-foreground">No agent</span>
                {!selectedAgentId ? (
                  <CheckIcon className="ml-auto size-3.5" />
                ) : null}
              </CommandItem>
              {agents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={agent.id}
                  onSelect={() => handleSelect(agent.id)}
                  className="text-xs"
                >
                  <BotIcon className={cn('size-3.5 mr-1', selectedAgentId === agent.id && 'text-primary')} />
                  <span className="truncate">{agent.name}</span>
                  {selectedAgentId === agent.id ? (
                    <CheckIcon className="ml-auto size-3.5" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
