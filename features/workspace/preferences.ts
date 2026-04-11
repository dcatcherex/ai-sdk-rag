import {
  DEFAULT_PINNED_WORKSPACE_ITEM_IDS,
  WORKSPACE_ITEM_IDS,
  type WorkspaceItemId,
} from "@/features/workspace/catalog";

export type WorkspacePreferencesState = {
  pinnedItemIds: WorkspaceItemId[];
  hiddenItemIds: WorkspaceItemId[];
};

export function normalizeWorkspaceItemIds(ids: string[] | null | undefined): WorkspaceItemId[] {
  if (!ids) return [];

  const seen = new Set<WorkspaceItemId>();
  const valid = new Set(WORKSPACE_ITEM_IDS);

  return ids.filter((id): id is WorkspaceItemId => {
    if (!valid.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function getEffectiveVisibleWorkspaceItemIds(hiddenItemIds: WorkspaceItemId[]): WorkspaceItemId[] {
  const hidden = new Set(hiddenItemIds);
  return WORKSPACE_ITEM_IDS.filter((id) => !hidden.has(id));
}

export function getEffectivePinnedWorkspaceItemIds(
  pinnedItemIds: WorkspaceItemId[] | null | undefined,
  hiddenItemIds: WorkspaceItemId[] | null | undefined,
): WorkspaceItemId[] {
  const normalizedHidden = normalizeWorkspaceItemIds(hiddenItemIds);
  const visible = new Set(getEffectiveVisibleWorkspaceItemIds(normalizedHidden));
  const normalizedPinned = normalizeWorkspaceItemIds(pinnedItemIds);

  if (pinnedItemIds !== null && pinnedItemIds !== undefined) {
    return normalizedPinned.filter((id) => visible.has(id));
  }

  return DEFAULT_PINNED_WORKSPACE_ITEM_IDS.filter((id) => visible.has(id));
}

export function getDefaultWorkspacePreferences(): WorkspacePreferencesState {
  return {
    pinnedItemIds: DEFAULT_PINNED_WORKSPACE_ITEM_IDS,
    hiddenItemIds: [],
  };
}
