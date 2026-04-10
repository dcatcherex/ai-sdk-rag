'use client';

import { BotIcon, GlobeIcon, PencilIcon, Share2Icon, Trash2Icon } from 'lucide-react';
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
  footer,
  className,
}: AgentCardProps) => {
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl border-2 border-black/5 dark:border-border bg-white dark:bg-zinc-900 overflow-hidden transition hover:border-primary/50',
        className,
      )}
    >
      {/* ── Image section ── */}
      <div className="relative aspect-square bg-background dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
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
            onClick={onToggleActive}
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
        {(onEdit || onShare || onDelete) && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition z-10">
            <ButtonGroup className="border rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow">
              {onShare && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-full hover:cursor-pointer"
                  onClick={onShare}
                  title="Share"
                >
                  <Share2Icon className="size-3.5" />
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-full hover:cursor-pointer"
                  onClick={onEdit}
                  title="Edit"
                >
                  <PencilIcon className="size-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-full text-destructive hover:text-destructive hover:cursor-pointer"
                  onClick={onDelete}
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
        {/* {footer && <div className="mt-auto pt-2">{footer}</div>} */}
      </div>
    </div>
  );
};
