'use client';

import { useState } from 'react';
import {
  BrainCircuitIcon,
  Building2Icon,
  DownloadIcon,
  KeyRoundIcon,
  LayersIcon,
  PanelLeftIcon,
  MessageCircleQuestionIcon,
  PaletteIcon,
  PlusIcon,
  SparklesIcon,
  WrenchIcon,
  ZapIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { SettingsShell, type SettingsShellItem } from '@/components/settings-shell';
import { ModelsTable } from '@/features/models/components/models-table';
import { useSettingsPreferences } from '@/features/settings/hooks/use-settings-preferences';
import { MemorySection } from '@/features/settings/components/memory-section';
import { ToolsSection } from '@/features/settings/components/tools-section';
import { ToggleSection } from '@/features/settings/components/toggle-section';
import { VoiceSection } from '@/features/settings/components/voice-section';
import { BrandsSection } from '@/features/brands/components/brands-section';
import { AppearanceSection } from '@/features/settings/components/appearance-section';
import { McpCredentialsSection } from '@/features/settings/components/mcp-credentials-section';
import { WorkspaceSection } from '@/features/settings/components/workspace-section';
import { ChatRunsCard } from '@/features/chat/components/chat-runs-card';
import { ALL_TOOL_IDS, type ToolId } from '@/lib/tool-registry';
import { useWorkspacePreferences } from '@/features/workspace/hooks/use-workspace-preferences';

type TabId = 'general' | 'workspace' | 'memory' | 'tools' | 'models' | 'brands' | 'appearance' | 'mcp';

const TABS: SettingsShellItem<TabId>[] = [
  {
    id: 'general',
    label: 'General',
    icon: ZapIcon,
    description: 'Chat experience preferences',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: PanelLeftIcon,
    description: 'Sidebar pages, pinning, and workspace visibility',
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: BrainCircuitIcon,
    description: 'Stored facts and context',
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: WrenchIcon,
    description: 'AI tool access and retrieval',
  },
  {
    id: 'models',
    label: 'Models',
    icon: BrainCircuitIcon,
    description: 'Enable or disable models available in your chat',
  },
  {
    id: 'brands',
    label: 'Brands',
    icon: Building2Icon,
    description: 'Brand identity, tone of voice, and creative assets',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: PaletteIcon,
    description: 'Fonts and visual preferences',
  },
  {
    id: 'mcp',
    label: 'MCP Credentials',
    icon: KeyRoundIcon,
    description: 'API keys and tokens for MCP servers',
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [showBrandImport, setShowBrandImport] = useState(false);
  const { prefs, updatePref } = useSettingsPreferences();
  const {
    pinnedItemIds: pinnedWorkspaceItemIds,
    hiddenItemIds: hiddenWorkspaceItemIds,
    updateWorkspaceItem,
  } = useWorkspacePreferences();

  const effectiveToolIds = prefs.enabledToolIds ?? ALL_TOOL_IDS;

  const toggleTool = async (toolId: ToolId, enabled: boolean) => {
    const next = enabled
      ? [...effectiveToolIds, toolId]
      : effectiveToolIds.filter((id) => id !== toolId);
    await updatePref({ enabledToolIds: next.length === ALL_TOOL_IDS.length ? null : next });
  };

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Settings"
        description="Customize your AI workspace, behavior, memory, tools, models, and brands"
      />

      <SettingsShell
        activeItem={activeTab}
        items={TABS}
        onItemChange={setActiveTab}
        sectionTitle={activeTabMeta.label}
        sectionDescription={activeTabMeta.description}
        contentClassName="space-y-8"
        sectionAction={activeTab === 'brands' ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setShowBrandImport((v) => !v)}>
              <DownloadIcon className="mr-1.5 size-3.5" />
              Import JSON
            </Button>
            <Button size="sm" onClick={() => setIsCreatingBrand(true)}>
              <PlusIcon className="mr-1.5 size-3.5" />
              New Brand
            </Button>
          </>
        ) : undefined}
      >
          {activeTab === 'general' && (
            <>
              <ToggleSection
                id="followup-toggle"
                icon={MessageCircleQuestionIcon}
                title="Follow-up Suggestions"
                description="After each response, the AI generates clickable follow-up question suggestions to help you continue the conversation."
                checked={prefs.followUpSuggestionsEnabled}
                onCheckedChange={(v) => void updatePref({ followUpSuggestionsEnabled: v })}
              />

              <ToggleSection
                id="enhance-toggle"
                icon={SparklesIcon}
                title="Prompt Enhancement"
                description="Before sending your message, a fast AI rewrites it to be more specific, add context, and clarify output format — while keeping your original intent. Your message is displayed unchanged; only the model sees the improved version."
                checked={prefs.promptEnhancementEnabled}
                onCheckedChange={(v) => void updatePref({ promptEnhancementEnabled: v })}
              />

              <VoiceSection
                selectedVoice={prefs.selectedVoice}
                onSelect={(voice) => void updatePref({ selectedVoice: voice })}
              />

              <ChatRunsCard />
            </>
          )}

          {activeTab === 'memory' && (
            <MemorySection prefs={prefs} onUpdatePref={updatePref} />
          )}

          {activeTab === 'workspace' && (
            <WorkspaceSection
              pinnedItemIds={pinnedWorkspaceItemIds}
              hiddenItemIds={hiddenWorkspaceItemIds}
              onUpdateItem={updateWorkspaceItem}
            />
          )}

          {activeTab === 'tools' && (
            <>
              <ToggleSection
                id="rerank-toggle"
                icon={LayersIcon}
                title="Reranking"
                description="After vector + BM25 retrieval, a Cohere cross-encoder re-scores candidates together with your query for higher precision. Adds ~300–600 ms per search. Recommended for large knowledge bases (100+ documents or 3,000+ chunks). Requires COHERE_API_KEY."
                checked={prefs.rerankEnabled}
                onCheckedChange={(v) => void updatePref({ rerankEnabled: v })}
              />

              <ToolsSection effectiveToolIds={effectiveToolIds} onToggleTool={toggleTool} />
            </>
          )}

          {activeTab === 'models' && (
            <ModelsTable />
          )}

          {activeTab === 'brands' && (
            <BrandsSection
              isCreating={isCreatingBrand}
              onCreatingChange={setIsCreatingBrand}
              showImport={showBrandImport}
              onShowImportChange={setShowBrandImport}
            />
          )}

          {activeTab === 'appearance' && (
            <AppearanceSection />
          )}

          {activeTab === 'mcp' && (
            <McpCredentialsSection
              credentials={prefs.mcpCredentials}
              onSave={(creds) => updatePref({ mcpCredentials: creds })}
            />
          )}
      </SettingsShell>
    </div>
  );
}
