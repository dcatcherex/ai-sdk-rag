import { PanelLeftIcon, PinIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  WORKSPACE_ITEMS,
  type WorkspaceItem,
} from "@/features/workspace/registry";
import type { WorkspaceItemId } from "@/features/workspace/catalog";

type Props = {
  pinnedItemIds: WorkspaceItemId[];
  hiddenItemIds: WorkspaceItemId[];
  onUpdateItem: (itemId: WorkspaceItemId, updates: { visible?: boolean; pinned?: boolean }) => Promise<void>;
};

function WorkspaceRow({
  item,
  isVisible,
  isPinned,
  onUpdateItem,
}: {
  item: WorkspaceItem;
  isVisible: boolean;
  isPinned: boolean;
  onUpdateItem: (updates: { visible?: boolean; pinned?: boolean }) => Promise<void>;
}) {
  return (
    <div className={cn(
      "flex items-start justify-between gap-4 rounded-lg border border-black/5 px-4 py-3 dark:border-border",
      !isVisible && "opacity-65",
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-muted-foreground">{item.icon}</span>
          <p className="text-sm font-medium">{item.label}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.source === "tool"
            ? "Workspace tool page"
            : "Workspace page"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-5">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>
          <Switch checked={isVisible} onCheckedChange={(checked) => void onUpdateItem({ visible: checked })} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Pin</span>
          <Switch
            checked={isPinned}
            disabled={!isVisible}
            onCheckedChange={(checked) => void onUpdateItem({ pinned: checked })}
          />
        </label>
      </div>
    </div>
  );
}

export function WorkspaceSection({ pinnedItemIds, hiddenItemIds, onUpdateItem }: Props) {
  const hidden = new Set(hiddenItemIds);
  const pinned = new Set(pinnedItemIds);
  const pinnedItems = WORKSPACE_ITEMS.filter((item) => pinned.has(item.id) && !hidden.has(item.id));
  const moreItems = WORKSPACE_ITEMS.filter((item) => !pinned.has(item.id));

  return (
    <section className="border-t border-black/5 pt-6 dark:border-border">
      <div className="mb-1 flex items-center gap-2">
        <PanelLeftIcon className="size-5 text-muted-foreground" />
        <h3 className="text-base font-semibold">Workspace</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose which pages appear in your workspace and which ones stay pinned in the sidebar for quick access.
      </p>

      {pinnedItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <PinIcon className="size-3.5" />
            Pinned
          </div>
          {pinnedItems.map((item) => (
            <WorkspaceRow
              key={item.id}
              item={item}
              isVisible
              isPinned
              onUpdateItem={(updates) => onUpdateItem(item.id, updates)}
            />
          ))}
        </div>
      )}

      {pinnedItems.length > 0 && moreItems.length > 0 && <Separator className="my-4" />}

      {moreItems.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            More
          </div>
          {moreItems.map((item) => (
            <WorkspaceRow
              key={item.id}
              item={item}
              isVisible={!hidden.has(item.id)}
              isPinned={pinned.has(item.id)}
              onUpdateItem={(updates) => onUpdateItem(item.id, updates)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
