import { TOOL_MANIFESTS } from "@/features/tools/registry/client";
import type { ToolManifest } from "@/features/tools/registry/types";

export type WorkspaceItemId = string;

export type WorkspaceMatchRule = {
  kind: "prefix";
  value: string;
};

export type WorkspaceCatalogItem = {
  id: WorkspaceItemId;
  href: string;
  label: string;
  defaultPinned: boolean;
  order: number;
  iconName: string;
  iconVariant?: "lucide" | "line";
  matchRules: WorkspaceMatchRule[];
  source: "page" | "tool";
  toolId?: string;
  toolSlug?: string;
};

const STATIC_WORKSPACE_ITEMS: WorkspaceCatalogItem[] = [
  {
    id: "gallery",
    href: "/gallery",
    label: "Media gallery",
    defaultPinned: false,
    order: 10,
    iconName: "Image",
    matchRules: [{ kind: "prefix", value: "/gallery" }],
    source: "page",
  },
  {
    id: "agents",
    href: "/agents",
    label: "AI Coworkers",
    defaultPinned: true,
    order: 20,
    iconName: "Bot",
    matchRules: [{ kind: "prefix", value: "/agents" }],
    source: "page",
  },
  {
    id: "skills",
    href: "/skills",
    label: "Skills",
    defaultPinned: true,
    order: 30,
    iconName: "Sparkles",
    matchRules: [{ kind: "prefix", value: "/skills" }],
    source: "page",
  },
  {
    id: "brands",
    href: "/brands",
    label: "Brands",
    defaultPinned: true,
    order: 35,
    iconName: "Building2",
    matchRules: [{ kind: "prefix", value: "/brands" }],
    source: "page",
  },
  {
    id: "line-oa",
    href: "/line-oa",
    label: "LINE OA",
    defaultPinned: true,
    order: 40,
    iconName: "Line",
    iconVariant: "line",
    matchRules: [{ kind: "prefix", value: "/line-oa" }],
    source: "page",
  },
  {
    id: "content",
    href: "/content",
    label: "Content",
    defaultPinned: true,
    order: 150,
    iconName: "Newspaper",
    matchRules: [{ kind: "prefix", value: "/content" }],
    source: "page",
  },
  {
    id: "knowledge",
    href: "/knowledge",
    label: "Knowledge",
    defaultPinned: false,
    order: 160,
    iconName: "BookOpen",
    matchRules: [{ kind: "prefix", value: "/knowledge" }],
    source: "page",
  },
  {
    id: "support",
    href: "/support",
    label: "Support",
    defaultPinned: false,
    order: 170,
    iconName: "MessageSquare",
    matchRules: [{ kind: "prefix", value: "/support" }],
    source: "page",
  },
  {
    id: "agent-teams",
    href: "/agent-teams",
    label: "Agent Teams",
    defaultPinned: false,
    order: 240,
    iconName: "Users",
    matchRules: [{ kind: "prefix", value: "/agent-teams" }],
    source: "page",
  },
  {
    id: "prompts",
    href: "/prompts",
    label: "Prompt Library",
    defaultPinned: false,
    order: 250,
    iconName: "FileText",
    matchRules: [{ kind: "prefix", value: "/prompts" }],
    source: "page",
  },
];

function toolToWorkspaceItem(manifest: ToolManifest): WorkspaceCatalogItem {
  return {
    id: manifest.id,
    href: `/tools/${manifest.slug}`,
    label: manifest.sidebar?.label ?? manifest.title,
    defaultPinned: manifest.sidebar?.defaultPinned ?? false,
    order: manifest.sidebar?.order ?? 500,
    iconName: manifest.icon,
    matchRules: [{ kind: "prefix", value: `/tools/${manifest.slug}` }],
    source: "tool",
    toolId: manifest.id,
    toolSlug: manifest.slug,
  };
}

const TOOL_WORKSPACE_ITEMS = TOOL_MANIFESTS
  .filter((manifest) => manifest.access.enabled && manifest.supportsSidebar)
  .map(toolToWorkspaceItem);

export const WORKSPACE_ITEM_CATALOG: WorkspaceCatalogItem[] = [...STATIC_WORKSPACE_ITEMS, ...TOOL_WORKSPACE_ITEMS]
  .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

export const WORKSPACE_ITEM_IDS = WORKSPACE_ITEM_CATALOG.map((item) => item.id);

export const DEFAULT_PINNED_WORKSPACE_ITEM_IDS = WORKSPACE_ITEM_CATALOG
  .filter((item) => item.defaultPinned)
  .map((item) => item.id);

export const WORKSPACE_ITEM_CATALOG_BY_ID = Object.fromEntries(
  WORKSPACE_ITEM_CATALOG.map((item) => [item.id, item]),
) as Record<WorkspaceItemId, WorkspaceCatalogItem>;

export function matchesWorkspaceItem(
  item: Pick<WorkspaceCatalogItem, "matchRules">,
  pathname: string,
): boolean {
  return item.matchRules.some((rule) => {
    if (rule.kind === "prefix") {
      return pathname.startsWith(rule.value);
    }

    return false;
  });
}
