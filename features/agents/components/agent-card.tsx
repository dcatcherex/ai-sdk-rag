'use client';

import type { KeyboardEvent } from 'react';
import Image from 'next/image';
import { BotIcon, GlobeIcon, MessageSquareIcon, PencilIcon, Share2Icon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { cn } from '@/lib/utils';

export type AgentCardProps = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  /** Custom icon component rendered in the avatar section. Defaults to BotIcon. */
  icon?: React.ElementType;
  /** When provided, shows an active/inactive status dot in the top-left. */
  isActive?: boolean;
  isPublic?: boolean;
  /** Called when the active toggle circle is clicked */
  onToggleActive?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onChat?: () => void;
  onHoverAction?: () => void;
  hoverActionTitle?: string;
  onClick?: () => void;
  /** Extra content rendered below the description (e.g. badges) */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Reusable visual agent card.
 * - Top image section with active/inactive toggle in the top-left corner.
 * - Name + description below.
 * - Edit / Share / Delete actions appear on hover.
 */
export const AgentCard = ({
  name,
  description,
  imageUrl,
  icon: Icon = BotIcon,
  isActive,
  isPublic,
  onToggleActive,
  onEdit,
  onDelete,
  onShare,
  onChat,
  onHoverAction,
  hoverActionTitle = 'Customize',
  onClick,
  footer,
  className,
}: AgentCardProps) => {
  const initials = name.slice(0, 2).toUpperCase();
  const cardAction = onClick ?? onEdit;
  const isClickable = Boolean(cardAction);

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!cardAction) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      cardAction();
    }
  };

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={cardAction}
      onKeyDown={handleCardKeyDown}
      className={cn(
        'group relative flex flex-col rounded-2xl border-2 border-black/5 dark:border-border bg-white dark:bg-zinc-900 overflow-hidden transition hover:border-primary/50',
        isClickable && 'cursor-pointer',
        className,
      )}
    >
      {/* ── Image section ── */}
      <div className="relative aspect-square bg-background dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(min-width: 1024px) 16rem, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 select-none">
            <Icon className="size-16 text-violet-300 dark:text-zinc-500" strokeWidth={1.2} />
            <span className="text-xs font-semibold text-violet-300 dark:text-zinc-500 tracking-widest">{initials}</span>
          </div>
        )}

        {/* Active/inactive toggle — top-left (only rendered when isActive is explicitly provided) */}
        {isActive !== undefined && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleActive?.();
            }}
            title={isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
            className={cn(
              'absolute top-3 left-3 size-4 rounded-full border-2 border-white shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              onToggleActive ? 'cursor-pointer hover:scale-110' : 'cursor-default',
              isActive ? 'bg-green-500' : 'bg-zinc-400',
            )}
          />
        )}

        {/* Public globe indicator */}
        {isPublic && (
          <span className="absolute top-3 right-3 rounded-full bg-white/80 dark:bg-zinc-800/80 p-1 backdrop-blur-sm">
            <GlobeIcon className="size-3 text-muted-foreground" />
          </span>
        )}

        {/* Hover actions — top-right */}
        {(onChat || onShare || onDelete || onHoverAction) && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition z-10">
            <ButtonGroup className="border rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow">
              {onHoverAction && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-full hover:cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onHoverAction();
                  }}
                  title={hoverActionTitle}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
              )}
              {onChat && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-full hover:cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChat();
                  }}
                  title="Chat"
                >
                  <MessageSquareIcon className="size-3.5" />
                </Button>
              )}
              {onShare && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-full hover:cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onShare();
                  }}
                  title="Share"
                >
                  <Share2Icon className="size-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-full text-destructive hover:text-destructive hover:cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete();
                  }}
                  title="Delete"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              )}
            </ButtonGroup>
          </div>
        )}
      </div>

      {/* ── Text section ── */}
      <div className="flex flex-col gap-1 p-4 flex-1 min-w-0 overflow-hidden">
        <p className="font-semibold text-sm truncate">{name}</p>
        {/* {description && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{description}</p>
        )} */}
        {footer && (
          <div
            className="mt-auto pt-2"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
