'use client';

import { useUserPreferences } from '@/features/settings/hooks/use-user-preferences';
import type { WorkspaceItemId } from '@/features/workspace/catalog';
import {
  getEffectivePinnedWorkspaceItemIds,
  getEffectiveVisibleWorkspaceItemIds,
  normalizeWorkspaceItemIds,
} from '@/features/workspace/preferences';

export function useWorkspacePreferences() {
  const { prefs, updatePref, isLoading, isUpdating } = useUserPreferences();

  const hiddenItemIds = normalizeWorkspaceItemIds(prefs.hiddenWorkspaceItemIds);
  const pinnedItemIds = getEffectivePinnedWorkspaceItemIds(
    prefs.pinnedWorkspaceItemIds,
    prefs.hiddenWorkspaceItemIds,
  );
  const visibleItemIds = getEffectiveVisibleWorkspaceItemIds(hiddenItemIds);

  const updateWorkspaceItem = async (
    itemId: WorkspaceItemId,
    updates: { visible?: boolean; pinned?: boolean },
  ) => {
    let nextHidden = hiddenItemIds;
    let nextPinned = pinnedItemIds;

    if (updates.visible !== undefined) {
      nextHidden = updates.visible
        ? hiddenItemIds.filter((id) => id !== itemId)
        : [...hiddenItemIds, itemId];
    }

    if (updates.pinned !== undefined) {
      nextPinned = updates.pinned
        ? [...pinnedItemIds, itemId]
        : pinnedItemIds.filter((id) => id !== itemId);
    }

    if (updates.visible === false) {
      nextPinned = nextPinned.filter((id) => id !== itemId);
    }

    const normalizedPinned = getEffectivePinnedWorkspaceItemIds(nextPinned, nextHidden);
    await updatePref({
      hiddenWorkspaceItemIds: nextHidden.length > 0 ? nextHidden : null,
      pinnedWorkspaceItemIds: normalizedPinned,
    });
  };

  const togglePinnedItem = async (itemId: WorkspaceItemId) => {
    await updateWorkspaceItem(itemId, { pinned: !pinnedItemIds.includes(itemId) });
  };

  const reorderPinnedItems = async (nextPinnedItemIds: WorkspaceItemId[]) => {
    const normalizedPinned = getEffectivePinnedWorkspaceItemIds(nextPinnedItemIds, hiddenItemIds);
    await updatePref({ pinnedWorkspaceItemIds: normalizedPinned });
  };

  return {
    prefs,
    pinnedItemIds,
    hiddenItemIds,
    visibleItemIds,
    updateWorkspaceItem,
    togglePinnedItem,
    reorderPinnedItems,
    isLoading,
    isUpdating,
  };
}
