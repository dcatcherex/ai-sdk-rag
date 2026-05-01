'use client';

import { useMemo, useState } from 'react';
import { BotIcon, CheckIcon, ChevronsUpDownIcon, PinIcon } from 'lucide-react';
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
import { useChatVisibleAgents } from '@/features/agents/hooks/use-chat-visible-agents';

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
  const { pinnedAgentIds, isPinned, togglePinned } = useChatVisibleAgents();

  const allKnown = [...agents, ...essentials];
  const selectedAgent = allKnown.find((a) => a.id === selectedAgentId) ?? null;
  const label = selectedAgent?.name ?? 'Vaja AI';

  const select = (id: string) => { onSelectAgent(id); setOpen(false); };

  const pinnedItems = useMemo(
    () => pinnedAgentIds
      .map((id) => allKnown.find((agent) => agent.id === id))
      .filter((agent): agent is Agent => Boolean(agent)),
    [allKnown, pinnedAgentIds],
  );

  const moreItems = useMemo(
    () => [
      ...essentials.filter((agent) => !pinnedAgentIds.includes(agent.id)),
      ...agents.filter((agent) => !pinnedAgentIds.includes(agent.id)),
    ],
    [agents, essentials, pinnedAgentIds],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
        >
          <BotIcon className="size-3.5" />
          <span className="max-w-[100px] truncate">{label}</span>
          <ChevronsUpDownIcon className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            {pinnedItems.length > 0 && (
              <>
                <CommandGroup heading="Pinned">
                  {pinnedItems.map((agent) => (
                    <CommandItem
                      key={agent.id}
                      value={`${agent.id}-${agent.name}`}
                      onSelect={() => select(agent.id)}
                      className="group text-xs"
                    >
                      <BotIcon
                        className={cn(
                          'size-3.5 mr-1.5 shrink-0',
                          selectedAgentId === agent.id && 'text-primary',
                        )}
                      />
                      <span className="truncate">{agent.name}</span>
                      <div className="ml-auto flex items-center gap-1">
                        {selectedAgentId === agent.id && (
                          <CheckIcon className="size-3.5" />
                        )}
                        <button
                          type="button"
                          aria-label={`Unpin ${agent.name}`}
                          className="rounded p-0.5 text-primary opacity-0 transition hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            togglePinned(agent.id);
                          }}
                        >
                          <PinIcon className="size-3.5 fill-current" />
                        </button>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {pinnedItems.length > 0 && moreItems.length > 0 && <CommandSeparator />}

            {moreItems.length > 0 && (
              <>
                <CommandGroup heading="More">
                  {moreItems.map((agent) => (
                    <CommandItem
                      key={agent.id}
                      value={`${agent.id}-${agent.name}`}
                      onSelect={() => select(agent.id)}
                      className="group text-xs"
                    >
                      <BotIcon
                        className={cn(
                          'size-3.5 mr-1.5 shrink-0',
                          selectedAgentId === agent.id && 'text-primary',
                        )}
                      />
                      <span className="truncate">{agent.name}</span>
                      <div className="ml-auto flex items-center gap-1">
                        {selectedAgentId === agent.id && (
                          <CheckIcon className="size-3.5" />
                        )}
                        <button
                          type="button"
                          aria-label={`${isPinned(agent.id) ? 'Unpin' : 'Pin'} ${agent.name}`}
                          className={cn(
                            'rounded p-0.5 opacity-0 transition hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100',
                            isPinned(agent.id) ? 'text-primary' : 'text-muted-foreground',
                          )}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            togglePinned(agent.id);
                          }}
                        >
                          <PinIcon className={cn('size-3.5', isPinned(agent.id) && 'fill-current')} />
                        </button>
                      </div>
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
