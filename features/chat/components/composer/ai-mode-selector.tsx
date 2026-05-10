'use client';

import { useMemo, useRef, useState } from 'react';
import { BotIcon, CheckIcon, ChevronDownIcon, ChevronsUpDownIcon, PinIcon, SearchIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Agent } from '@/features/agents/types';
import { useChatVisibleAgents } from '@/features/agents/hooks/use-chat-visible-agents';

const MAX_VISIBLE = 5;

type AiModeSelectorProps = {
  agents: Agent[];
  essentials: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  variant?: 'default' | 'minimal';
};

export const AiModeSelector = ({
  agents,
  essentials,
  selectedAgentId,
  onSelectAgent,
  variant = 'default',
}: AiModeSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { pinnedAgentIds, isPinned, togglePinned } = useChatVisibleAgents();

  const allKnown = [...agents, ...essentials];
  const selectedAgent = allKnown.find((a) => a.id === selectedAgentId) ?? null;
  const label = selectedAgent?.name ?? 'Vaja AI';

  const pinnedItems = useMemo(
    () => pinnedAgentIds
      .map((id) => allKnown.find((a) => a.id === id))
      .filter((a): a is Agent => Boolean(a)),
    [allKnown, pinnedAgentIds],
  );

  const moreItems = useMemo(
    () => [
      ...essentials.filter((a) => !pinnedAgentIds.includes(a.id)),
      ...agents.filter((a) => !pinnedAgentIds.includes(a.id)),
    ],
    [agents, essentials, pinnedAgentIds],
  );

  // When searching, flatten everything and filter
  const isSearching = searchOpen && query.trim() !== '';
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = query.toLowerCase();
    return allKnown.filter((a) => a.name.toLowerCase().includes(q));
  }, [isSearching, query, allKnown]);

  const allMore = moreItems;
  const visibleMore = showAll || isSearching ? allMore : allMore.slice(0, Math.max(0, MAX_VISIBLE - pinnedItems.length));
  const hiddenCount = allMore.length - visibleMore.length;

  const select = (id: string) => {
    onSelectAgent(id);
    setOpen(false);
    setSearchOpen(false);
    setQuery('');
    setShowAll(false);
  };

  const handleOpenSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleCloseSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearchOpen(false);
      setQuery('');
      setShowAll(false);
    }
  };

  const AgentRow = ({ agent, showPin = true }: { agent: Agent; showPin?: boolean }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => select(agent.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') select(agent.id); }}
      className="group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
    >
      <BotIcon className={cn('size-3.5 shrink-0', selectedAgentId === agent.id && 'text-primary')} />
      <span className="min-w-0 flex-1 truncate">{agent.name}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {selectedAgentId === agent.id && <CheckIcon className="size-3.5 text-primary" />}
        {showPin && (
          <button
            type="button"
            aria-label={`${isPinned(agent.id) ? 'Unpin' : 'Pin'} ${agent.name}`}
            className={cn(
              'rounded p-0.5 opacity-0 transition hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100',
              isPinned(agent.id) ? 'text-primary' : 'text-muted-foreground',
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePinned(agent.id); }}
          >
            <PinIcon className={cn('size-3', isPinned(agent.id) && 'fill-current')} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {variant === 'minimal' ? (
          <button
            type="button"
            className="flex items-center gap-1 text-base font-semibold text-foreground transition-opacity hover:opacity-70"
          >
            <span className="max-w-[200px] min-w-0 truncate">{label}</span>
            <ChevronDownIcon className="size-4 opacity-60" />
          </button>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="h-9 min-w-0 max-w-[172px] gap-1.5 rounded-full bg-primary px-3 text-xs shadow-sm"
          >
            <BotIcon className="size-3.5" />
            <span className="min-w-0 truncate">{label}</span>
            <ChevronsUpDownIcon className="size-3 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-64 p-2" align="start">
        {/* Header */}
        <div className="mb-1 flex items-center justify-between px-1">
          {searchOpen ? (
            <div className="flex flex-1 items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1">
              <SearchIcon className="size-3 shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
              <button type="button" onClick={handleCloseSearch} className="shrink-0 text-muted-foreground hover:text-foreground">
                <XIcon className="size-3" />
              </button>
            </div>
          ) : (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Agents</span>
              <button
                type="button"
                aria-label="Search agents"
                onClick={handleOpenSearch}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <SearchIcon className="size-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Search results */}
        {isSearching ? (
          <div className="space-y-0.5">
            {searchResults.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">No agents found</p>
            ) : (
              searchResults.map((agent) => <AgentRow key={agent.id} agent={agent} />)
            )}
          </div>
        ) : (
          <>
            {/* Pinned */}
            {pinnedItems.length > 0 && (
              <div className="mb-1">
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Pinned</p>
                <div className="space-y-0.5">
                  {pinnedItems.map((agent) => <AgentRow key={agent.id} agent={agent} />)}
                </div>
              </div>
            )}

            {/* More */}
            {visibleMore.length > 0 && (
              <div>
                {pinnedItems.length > 0 && (
                  <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">More</p>
                )}
                <div className="space-y-0.5">
                  {visibleMore.map((agent) => <AgentRow key={agent.id} agent={agent} />)}
                </div>
              </div>
            )}

            {/* Show more */}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                + {hiddenCount} more
              </button>
            )}

            {pinnedItems.length === 0 && moreItems.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">No agents available</p>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
