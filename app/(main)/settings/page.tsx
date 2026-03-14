'use client';

import Link from 'next/link';
import { BrainCircuitIcon, MessageCircleQuestionIcon, ScanTextIcon, SparklesIcon, LayersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettingsPreferences } from '@/features/settings/hooks/use-settings-preferences';
import { MemorySection } from '@/features/settings/components/memory-section';
import { PersonaInstructionsSection } from '@/features/settings/components/persona-instructions-section';
import { CustomPersonasSection } from '@/features/settings/components/custom-personas-section';
import { ToolsSection } from '@/features/settings/components/tools-section';
import { ToggleSection } from '@/features/settings/components/toggle-section';
import { ALL_TOOL_IDS, type ToolId } from '@/lib/tool-registry';
import { PageHeader } from '@/components/page-header';

export default function SettingsPage() {
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

  return (
    <>
      <PageHeader title="Settings" description="Manage your preferences and configuration." />

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        <MemorySection prefs={prefs} onUpdatePref={updatePref} />

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

        <ToggleSection
          id="enhance-toggle"
          icon={SparklesIcon}
          title="Prompt Enhancement"
          description="Before sending your message, a fast AI rewrites it to be more specific, add context, and clarify output format — while keeping your original intent. Your message is displayed unchanged; only the model sees the improved version."
          checked={prefs.promptEnhancementEnabled}
          onCheckedChange={(v) => void updatePref({ promptEnhancementEnabled: v })}
        />

        <ToggleSection
          id="followup-toggle"
          icon={MessageCircleQuestionIcon}
          title="Follow-up Suggestions"
          description="After each response, the AI generates clickable follow-up question suggestions to help you continue the conversation."
          checked={prefs.followUpSuggestionsEnabled}
          onCheckedChange={(v) => void updatePref({ followUpSuggestionsEnabled: v })}
        />

        <ToggleSection
          id="rerank-toggle"
          icon={LayersIcon}
          title="Reranking"
          description="After vector + BM25 retrieval, a Cohere cross-encoder re-scores candidates together with your query for higher precision. Adds ~300–600 ms per search. Recommended for large knowledge bases (100+ documents or 3,000+ chunks). Requires COHERE_API_KEY."
          checked={prefs.rerankEnabled}
          onCheckedChange={(v) => void updatePref({ rerankEnabled: v })}
        />

        <ToolsSection effectiveToolIds={effectiveToolIds} onToggleTool={toggleTool} />

        <section className="border-t border-black/5 dark:border-border pt-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/models">
              <BrainCircuitIcon className="mr-2 size-4" />
              Manage enabled models →
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}
