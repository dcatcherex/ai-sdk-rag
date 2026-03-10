'use client';

import { useState } from 'react';
import { CheckIcon, ChevronsUpDownIcon, UserCircle2Icon } from 'lucide-react';
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
import { systemPromptList } from '@/lib/prompt';
import type { CustomPersona } from '../types/custom-persona';

type PersonaSelectorProps = {
  customPersonas: CustomPersona[];
  selectedPersonaId: string | null;
  onSelectPersona: (id: string | null) => void;
};

export const PersonaSelector = ({
  customPersonas,
  selectedPersonaId,
  onSelectPersona,
}: PersonaSelectorProps) => {
  const [open, setOpen] = useState(false);

  const selectedCustom = customPersonas.find((p) => p.id === selectedPersonaId) ?? null;
  const selectedBuiltin = systemPromptList.find((p) => p.key === selectedPersonaId) ?? null;
  const selectedLabel = selectedCustom?.name ?? selectedBuiltin?.label ?? null;

  const handleSelect = (id: string | null) => {
    onSelectPersona(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={selectedPersonaId ? 'default' : 'ghost'}
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs hover:cursor-pointer"
        >
          <UserCircle2Icon className="size-3.5" />
          <span className="max-w-[100px] truncate">
            {selectedLabel ?? 'Persona'}
          </span>
          <ChevronsUpDownIcon className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search personas…" className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No personas found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="auto"
                onSelect={() => handleSelect(null)}
                className="text-xs"
              >
                <span className="text-muted-foreground">Auto-detect</span>
                {!selectedPersonaId && <CheckIcon className="ml-auto size-3.5" />}
              </CommandItem>
            </CommandGroup>

            {customPersonas.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Custom">
                  {customPersonas.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => handleSelect(p.id)}
                      className="text-xs"
                    >
                      <UserCircle2Icon className={cn('size-3.5 mr-1', selectedPersonaId === p.id && 'text-primary')} />
                      <span className="truncate">{p.name}</span>
                      {selectedPersonaId === p.id && <CheckIcon className="ml-auto size-3.5" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup heading="Built-in">
              {systemPromptList.map((p) => (
                <CommandItem
                  key={p.key}
                  value={p.key}
                  onSelect={() => handleSelect(p.key)}
                  className="text-xs"
                >
                  <span className={cn('truncate', selectedPersonaId === p.key ? 'font-medium' : 'text-muted-foreground')}>
                    {p.label}
                  </span>
                  {selectedPersonaId === p.key && <CheckIcon className="ml-auto size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
