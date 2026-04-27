'use client';

import { useEffect } from 'react';
import { useUserPreferences } from '@/features/settings/hooks/use-user-preferences';
import type { WorkspaceItemId } from '@/features/workspace/catalog';
import {
  getEffectivePinnedWorkspaceItemIds,
  getEffectiveVisibleWorkspaceItemIds,
  normalizeWorkspaceItemIds,
} from '@/features/workspace/preferences';

const BRANDS_PIN_MIGRATION_KEY = 'workspace-brands-pin-migration-v1';
const BRANDS_ITEM_ID: WorkspaceItemId = 'brands';

export function useWorkspacePreferences() {
  const { prefs, updatePref, isLoading, isUpdating } = useUserPreferences();

  const hiddenItemIds = normalizeWorkspaceItemIds(prefs.hiddenWorkspaceItemIds);
  const pinnedItemIds = getEffectivePinnedWorkspaceItemIds(
    prefs.pinnedWorkspaceItemIds,
    prefs.hiddenWorkspaceItemIds,
  );
  const visibleItemIds = getEffectiveVisibleWorkspaceItemIds(hiddenItemIds);

  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;
    if (prefs.pinnedWorkspaceItemIds === null) return;
    if (hiddenItemIds.includes(BRANDS_ITEM_ID) || pinnedItemIds.includes(BRANDS_ITEM_ID)) return;
    if (window.localStorage.getItem(BRANDS_PIN_MIGRATION_KEY)) return;

    window.localStorage.setItem(BRANDS_PIN_MIGRATION_KEY, 'done');
    void updatePref({ pinnedWorkspaceItemIds: [...pinnedItemIds, BRANDS_ITEM_ID] });
  }, [hiddenItemIds, isLoading, pinnedItemIds, prefs.pinnedWorkspaceItemIds, updatePref]);

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
