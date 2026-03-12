"use client";

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
import { GripVerticalIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { SidebarNavItemId } from "./sidebar-nav";

type OptionalItem = {
  id: SidebarNavItemId;
  label: string;
  icon: React.ReactNode;
};

type Props = {
  items: OptionalItem[];
  visibleItemIds: SidebarNavItemId[];
  onToggleItemVisibility: (itemId: SidebarNavItemId, checked: boolean) => void;
  onReorderItems: (orderedItemIds: SidebarNavItemId[]) => void;
};

type SortableRowProps = {
  item: OptionalItem;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const SortableRow = ({ item, checked, onCheckedChange }: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2 py-2",
        isDragging && "z-10 shadow-md",
      )}
    >
      <button
        type="button"
        className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        aria-label={`Reorder ${item.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <Checkbox checked={checked} onCheckedChange={(next) => onCheckedChange(next === true)} />
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="shrink-0 text-muted-foreground">{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </div>
    </div>
  );
};

export const SidebarOptionalItemsMenu = ({
  items,
  visibleItemIds,
  onToggleItemVisibility,
  onReorderItems,
}: Props) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const nextItems = arrayMove(items, oldIndex, newIndex);
    onReorderItems(nextItems.map((item) => item.id));
  };

  return (
    <div className="space-y-2 p-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortableRow
                key={item.id}
                item={item}
                checked={visibleItemIds.includes(item.id)}
                onCheckedChange={(checked) => onToggleItemVisibility(item.id, checked)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
