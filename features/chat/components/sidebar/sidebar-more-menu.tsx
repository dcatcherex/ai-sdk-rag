"use client";

import Link from "next/link";
import { CSS } from "@dnd-kit/utilities";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVerticalIcon, PinIcon, SettingsIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { NAV_REGISTRY, type NavItem, type NavItemId } from "./sidebar-nav";

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  currentPath: string;
  pinnedItemIds: NavItemId[];
  onTogglePin: (itemId: NavItemId) => void;
  onReorderPinned: (orderedItemIds: NavItemId[]) => void;
};

// ─── Pinned row (draggable) ───────────────────────────────────────────────────

const SortablePinnedRow = ({
  item,
  isActive,
  onTogglePin,
}: {
  item: NavItem;
  isActive: boolean;
  onTogglePin: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1 rounded-md px-2 py-1",
        isDragging && "z-10 bg-accent shadow-md",
        !isDragging && "hover:bg-accent/60",
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
        aria-label={`Drag to reorder ${item.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-3.5" />
      </button>

      {/* Nav link */}
      <Link
        href={item.href}
        className={cn(
          "flex flex-1 items-center gap-2 rounded-sm px-1 py-1 text-sm",
          isActive ? "font-medium text-foreground" : "text-foreground/80",
        )}
      >
        <span className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground")}>
          {item.icon}
        </span>
        <span className="truncate">{item.label}</span>
      </Link>

      {/* Pin button — filled = pinned */}
      <button
        type="button"
        onClick={onTogglePin}
        title="Unpin from sidebar"
        className="flex size-6 shrink-0 items-center justify-center rounded-sm transition hover:bg-background"
      >
        <PinIcon className="size-3.5 fill-primary text-primary" />
      </button>
    </div>
  );
};

// ─── Unpinned row ─────────────────────────────────────────────────────────────

const UnpinnedRow = ({
  item,
  isActive,
  onTogglePin,
}: {
  item: NavItem;
  isActive: boolean;
  onTogglePin: () => void;
}) => (
  <div className="group flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent/60">
    {/* Spacer for alignment with draggable rows */}
    <div className="size-6 shrink-0" />

    <Link
      href={item.href}
      className={cn(
        "flex flex-1 items-center gap-2 rounded-sm px-1 py-1 text-sm",
        isActive ? "font-medium text-foreground" : "text-foreground/80",
      )}
    >
      <span className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground")}>
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
    </Link>

    {/* Pin button — outline = unpinned */}
    <button
      type="button"
      onClick={onTogglePin}
      title="Pin to sidebar"
      className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-background hover:text-foreground"
    >
      <PinIcon className="size-3.5" />
    </button>
  </div>
);

// ─── SidebarMoreMenuContent ───────────────────────────────────────────────────

export const SidebarMoreMenuContent = ({
  currentPath,
  pinnedItemIds,
  onTogglePin,
  onReorderPinned,
}: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pinnedItems = pinnedItemIds
    .map((id) => NAV_REGISTRY.find((item) => item.id === id))
    .filter((item): item is NavItem => item !== undefined);

  const unpinnedItems = NAV_REGISTRY.filter(
    (item) => !pinnedItemIds.includes(item.id),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pinnedItemIds.indexOf(active.id as NavItemId);
    const newIndex = pinnedItemIds.indexOf(over.id as NavItemId);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorderPinned(arrayMove(pinnedItemIds, oldIndex, newIndex));
  };

  return (
    <div className="py-1.5">
      {/* Pinned section */}
      {pinnedItems.length > 0 && (
        <div>
          <div className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Pinned
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pinnedItemIds} strategy={verticalListSortingStrategy}>
              <div className="px-1">
                {pinnedItems.map((item) => (
                  <SortablePinnedRow
                    key={item.id}
                    item={item}
                    isActive={item.matchFn(currentPath)}
                    onTogglePin={() => onTogglePin(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Unpinned section */}
      {unpinnedItems.length > 0 && (
        <div>
          {pinnedItems.length > 0 && <Separator className="my-1.5" />}
          <div className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            More
          </div>
          <div className="px-1">
            {unpinnedItems.map((item) => (
              <UnpinnedRow
                key={item.id}
                item={item}
                isActive={item.matchFn(currentPath)}
                onTogglePin={() => onTogglePin(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <Separator className="my-1.5" />
      <div className="px-1">
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
        >
          <SettingsIcon className="size-3.5 shrink-0" />
          Manage sidebar
        </Link>
      </div>
    </div>
  );
};
