/**
 * Tool registry — single source of truth for all tool metadata.
 *
 * Registry-managed tools (quiz, certificate, ...) are derived from their
 * manifests in features/tools/registry/client.ts so that label, description,
 * and defaultEnabled stay in sync with the manifest automatically.
 *
 * Non-sidebar tools (weather, knowledge_base) are defined here directly
 * because they do not have manifests — they are agent-only utilities.
 */

import { TOOL_MANIFESTS } from '@/features/tools/registry/client';

export type ToolGroup = 'utilities' | 'knowledge' | 'productivity';

export type ToolRegistryEntry = {
  label: string;
  description: string;
  group: ToolGroup;
  /** Whether this tool is enabled by default for new users */
  defaultEnabled: boolean;
};

// ── Category → group mapping ──────────────────────────────────────────────────

const CATEGORY_TO_GROUP: Record<string, ToolGroup> = {
  study:      'productivity',
  content:    'productivity',
  assessment: 'productivity',
  admin:      'productivity',
  utilities:  'utilities',
  developer:  'utilities',
};

// ── Non-manifest tools (agent-only, no sidebar page) ─────────────────────────

const STATIC_ENTRIES: Record<string, ToolRegistryEntry> = {
  weather: {
    label: 'Weather',
    description: 'Get current weather for any location and convert temperatures.',
    group: 'utilities',
    defaultEnabled: true,
  },
  knowledge_base: {
    label: 'Knowledge Base',
    description: 'Search and retrieve information from your document library.',
    group: 'knowledge',
    defaultEnabled: true,
  },
};

// ── Build the full registry ───────────────────────────────────────────────────

// Derive manifest-managed tools from their manifests (single source of truth)
const manifestEntries = Object.fromEntries(
  TOOL_MANIFESTS.map((m) => [
    m.id,
    {
      label: m.title,
      description: m.description,
      group: CATEGORY_TO_GROUP[m.category] ?? 'productivity',
      defaultEnabled: m.defaultEnabled,
    } satisfies ToolRegistryEntry,
  ]),
);

export const TOOL_REGISTRY = {
  ...STATIC_ENTRIES,
  ...manifestEntries,
} as const as Record<string, ToolRegistryEntry>;

export type ToolId = keyof typeof STATIC_ENTRIES | (typeof TOOL_MANIFESTS)[number]['id'];

export const ALL_TOOL_IDS = Object.keys(TOOL_REGISTRY) as ToolId[];

export const DEFAULT_TOOL_IDS = ALL_TOOL_IDS.filter(
  (id) => TOOL_REGISTRY[id].defaultEnabled,
);
