'use client';

import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SettingsShellItem<T extends string = string> = {
  id: T;
  icon: ElementType;
  label: string;
  description?: string;
};

type SettingsShellProps<T extends string = string> = {
  activeItem: T;
  children: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
  footerClassName?: string;
  items: SettingsShellItem<T>[];
  onItemChange: (item: T) => void;
  sectionAction?: ReactNode;
  sectionDescription?: string;
  sectionTitle: string;
  sidebarLabel?: string;
};

export function SettingsShell<T extends string = string>({
  activeItem,
  children,
  contentClassName,
  footer,
  footerClassName,
  items,
  onItemChange,
  sectionAction,
  sectionDescription,
  sectionTitle,
  sidebarLabel,
}: SettingsShellProps<T>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <nav className="hidden w-52 shrink-0 flex-col border-r border-black/5 bg-black/1 px-2 py-4 gap-0.5 dark:border-border dark:bg-white/1 md:flex">
          {sidebarLabel ? (
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {sidebarLabel}
            </p>
          ) : null}
          {items.map(({ id, label, icon: Icon }) => {
            const isActive = activeItem === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onItemChange(id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                  isActive
                    ? 'bg-primary/8 text-foreground dark:bg-primary/12'
                    : 'text-muted-foreground hover:bg-black/4 hover:text-foreground dark:hover:bg-white/4'
                )}
              >
                <Icon className={cn('size-4 shrink-0', isActive && 'text-primary')} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 overflow-x-auto border-b border-black/5 dark:border-border md:hidden">
            {items.map(({ id, label, icon: Icon }) => {
              const isActive = activeItem === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onItemChange(id)}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="shrink-0 border-b border-black/5 px-6 py-5 dark:border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{sectionTitle}</h2>
                {sectionDescription ? <p className="text-sm text-muted-foreground">{sectionDescription}</p> : null}
              </div>
              {sectionAction ? <div className="flex items-center gap-2">{sectionAction}</div> : null}
            </div>
          </div>

          <div className={cn('flex-1 overflow-y-auto px-6 py-6', contentClassName)}>{children}</div>
        </div>
      </div>

      {footer ? (
        <div className={cn('shrink-0 flex items-center justify-end border-t border-black/5 bg-background px-6 py-4 dark:border-border', footerClassName)}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
