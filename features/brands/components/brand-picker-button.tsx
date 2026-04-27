'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2Icon, CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Brand } from '../types';

const STORAGE_KEY = 'chat-active-brand-id';

export function getActiveBrandId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setActiveBrandId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent('active-brand-change', { detail: id }));
}

type Props = {
  isCollapsed?: boolean;
};

export function BrandPickerButton({ isCollapsed = false }: Props) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(null);

  // Load brands once
  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/brands');
      if (res.ok) setBrands((await res.json()) as Brand[]);
    })();
  }, []);

  // Sync from localStorage on mount + cross-tab
  useEffect(() => {
    setActiveBrandIdState(getActiveBrandId());
    const handler = (e: Event) => {
      setActiveBrandIdState((e as CustomEvent<string | null>).detail);
    };
    window.addEventListener('active-brand-change', handler);
    return () => window.removeEventListener('active-brand-change', handler);
  }, []);

  const select = (id: string | null) => {
    setActiveBrandId(id);
    setActiveBrandIdState(id);
  };

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? null;
  const primaryColor = activeBrand?.colors[0]?.hex;

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size={isCollapsed ? 'icon' : 'icon'}
                className={cn(
                  'relative size-9 shrink-0',
                  activeBrand && 'opacity-100',
                  !activeBrand && 'opacity-50 hover:opacity-100',
                )}
                aria-label="Active brand"
              >
                {activeBrand ? (
                  <>
                    {/* Color dot overlay when brand is active */}
                    <span
                      className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-background"
                      style={{ background: primaryColor ?? 'hsl(var(--primary))' }}
                    />
                    <Building2Icon className="size-4" />
                  </>
                ) : (
                  <Building2Icon className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side={isCollapsed ? 'right' : 'top'}>
            {activeBrand ? `Brand: ${activeBrand.name}` : 'No active brand'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent side="top" align="end" className="w-52">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          Active Brand
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* No brand option */}
        <DropdownMenuItem
          onClick={() => select(null)}
          className="flex items-center gap-2.5"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md border border-black/10 dark:border-border bg-muted">
            <Building2Icon className="size-3 text-muted-foreground" />
          </span>
          <span className="flex-1 text-sm">No brand</span>
          {!activeBrandId && <CheckIcon className="size-3.5 text-primary" />}
        </DropdownMenuItem>

        {brands.length > 0 && <DropdownMenuSeparator />}

        {/* Own brands */}
        {brands.filter((b) => b.isOwner !== false).map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => select(b.id)}
            className="flex items-center gap-2.5"
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
              style={{ background: b.colors[0]?.hex ?? 'hsl(var(--muted))' }}
            >
              <Building2Icon className="size-3 text-white" />
            </span>
            <span className="flex-1 truncate text-sm">{b.name}</span>
            {activeBrandId === b.id && <CheckIcon className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}

        {/* Shared brands */}
        {brands.some((b) => b.isOwner === false) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 px-2 py-1">
              Shared with me
            </DropdownMenuLabel>
            {brands.filter((b) => b.isOwner === false).map((b) => (
              <DropdownMenuItem
                key={b.id}
                onClick={() => select(b.id)}
                className="flex items-center gap-2.5"
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                  style={{ background: b.colors[0]?.hex ?? 'hsl(var(--muted))' }}
                >
                  <Building2Icon className="size-3 text-white" />
                </span>
                <span className="flex-1 truncate text-sm">{b.name}</span>
                {activeBrandId === b.id && <CheckIcon className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {brands.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground italic">
            No brands yet. Create one from Brands.
          </p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/brands" className="flex items-center gap-2.5">
            <Building2Icon className="size-4" />
            Manage brands
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
