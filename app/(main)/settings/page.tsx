'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  BrainCircuitIcon,
  LayersIcon,
  MessageCircleQuestionIcon,
  ScanTextIcon,
  SparklesIcon,
  WrenchIcon,
  ZapIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettingsPreferences } from '@/features/settings/hooks/use-settings-preferences';
import { MemorySection } from '@/features/settings/components/memory-section';
import { PersonaInstructionsSection } from '@/features/settings/components/persona-instructions-section';
import { CustomPersonasSection } from '@/features/settings/components/custom-personas-section';
import { ToolsSection } from '@/features/settings/components/tools-section';
import { ToggleSection } from '@/features/settings/components/toggle-section';
import { ALL_TOOL_IDS, type ToolId } from '@/lib/tool-registry';

type TabId = 'general' | 'ai-behavior' | 'memory' | 'tools';

const TABS: { id: TabId; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: 'general',
    label: 'General',
    icon: ZapIcon,
    description: 'Chat experience preferences',
  },
  {
    id: 'ai-behavior',
    label: 'AI Behavior',
    icon: ScanTextIcon,
    description: 'Personas and response style',
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
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const { prefs, updatePref, personaInstructions, setPersonaInstructions } = useSettingsPreferences();

  const effectiveToolIds = prefs.enabledToolIds ?? ALL_TOOL_IDS;

  const toggleTool = async (toolId: ToolId, enabled: boolean) => {
    const next = enabled
      ? [...effectiveToolIds, toolId]
      : effectiveToolIds.filter((id) => id !== toolId);
    await updatePref({ enabledToolIds: next.length === ALL_TOOL_IDS.length ? null : next });
  };

  const savePersonaInstructions = async (key: string, value: string) => {
    await fetch('/api/user/persona-instructions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaKey: key, extraInstructions: value }),
    });
    setPersonaInstructions((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
      <nav className="hidden md:flex w-52 shrink-0 flex-col border-r border-black/5 dark:border-border bg-black/1 dark:bg-white/1 px-2 py-4 gap-0.5">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Settings</p>
        {TABS.map(({ id, label, icon: Icon, description }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                isActive
                  ? 'bg-primary/8 dark:bg-primary/12 text-foreground'
                  : 'text-muted-foreground hover:bg-black/4 dark:hover:bg-white/4 hover:text-foreground'
              }`}
            >
              <Icon className={`size-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile tab bar */}
      <div className="md:hidden flex shrink-0 border-b border-black/5 dark:border-border overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Section header */}
        <div className="shrink-0 border-b border-black/5 dark:border-border px-6 py-4">
          <h2 className="text-lg font-semibold">{activeTabMeta.label}</h2>
          <p className="text-sm text-muted-foreground">{activeTabMeta.description}</p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
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
            </>
          )}

          {activeTab === 'ai-behavior' && (
            <>
              <ToggleSection
                id="persona-toggle"
                icon={ScanTextIcon}
                title="Auto Persona"
                description="Automatically detects the intent of your message (coding, research, writing, etc.) and switches the AI's system prompt to match. When off, the AI always uses the general assistant persona."
                checked={prefs.personaDetectionEnabled}
                onCheckedChange={(v) => void updatePref({ personaDetectionEnabled: v })}
              />

              <PersonaInstructionsSection
                personaInstructions={personaInstructions}
                onSave={savePersonaInstructions}
              />

              <CustomPersonasSection />
            </>
          )}

          {activeTab === 'memory' && (
            <MemorySection prefs={prefs} onUpdatePref={updatePref} />
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

          {/* Models link — shown at bottom of every tab */}
          <div className="border-t border-black/5 dark:border-border pt-6">
            <Button variant="outline" size="sm" asChild>
              <Link href="/models">
                <BrainCircuitIcon className="mr-2 size-4" />
                Manage enabled models →
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
