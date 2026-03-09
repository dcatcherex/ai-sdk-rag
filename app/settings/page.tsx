'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrainCircuitIcon, MessageCircleQuestionIcon, ScanTextIcon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatSidebar } from '@/features/chat/components/chat-sidebar';
import { useThreads, setNewChatIntent } from '@/features/chat/hooks/use-threads';
import { useUserProfile } from '@/features/chat/hooks/use-user-profile';
import { useSettingsPreferences } from '@/features/settings/hooks/use-settings-preferences';
import { MemorySection } from '@/features/settings/components/memory-section';
import { PersonaInstructionsSection } from '@/features/settings/components/persona-instructions-section';
import { CustomPersonasSection } from '@/features/settings/components/custom-personas-section';
import { ToolsSection } from '@/features/settings/components/tools-section';
import { ToggleSection } from '@/features/settings/components/toggle-section';
import { ALL_TOOL_IDS, type ToolId } from '@/lib/tool-registry';

export default function SettingsPage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const {
    activeThreadId,
    setActiveThreadId,
    threads,
    isThreadsLoading,
    createThreadMutation,
    pinThreadMutation,
    renameThreadMutation,
    deleteThreadMutation,
  } = useThreads();

  const { sessionData, userProfile, isSigningOut, handleSignOut } = useUserProfile();

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f7f7f9,#eef0f7_55%,#e6e9f2_100%)] dark:bg-[radial-gradient(circle_at_top,#1a1b2e,#111827_55%,#0f172a_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-3 px-2 py-2 md:gap-6 md:px-4 md:py-6">
        <ChatSidebar
          activeThreadId={activeThreadId}
          threads={threads}
          isLoading={isThreadsLoading}
          isCreatingThread={createThreadMutation.isPending}
          onSelectThread={(threadId) => { setActiveThreadId(threadId); router.push('/'); }}
          onCreateThread={() => { setNewChatIntent(); router.push('/'); }}
          onTogglePin={(threadId, pinned) => pinThreadMutation.mutate({ threadId, pinned })}
          onRenameThread={(threadId, title) => renameThreadMutation.mutate({ threadId, title })}
          onDeleteThread={(threadId) => deleteThreadMutation.mutate(threadId)}
          sessionData={sessionData}
          userProfile={userProfile}
          isSigningOut={isSigningOut}
          onSignOut={handleSignOut}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
        />

        <main className="flex h-[calc(100dvh-1rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 shadow-[0_35px_80px_-60px_rgba(15,23,42,0.5)] dark:shadow-[0_35px_80px_-60px_rgba(0,0,0,0.7)] backdrop-blur md:h-[calc(100vh-3rem)] md:rounded-3xl">
          <div className="border-b border-black/5 dark:border-white/10 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Configuration</p>
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          </div>

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

            <ToolsSection effectiveToolIds={effectiveToolIds} onToggleTool={toggleTool} />

            <section className="border-t border-black/5 dark:border-white/10 pt-6">
              <Button variant="outline" size="sm" asChild>
                <Link href="/models">
                  <BrainCircuitIcon className="mr-2 size-4" />
                  Manage enabled models →
                </Link>
              </Button>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
