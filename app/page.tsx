'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppAccessGuard } from '@/features/auth/components/app-access-guard';
import { KnowledgeSheet } from '@/components/knowledge/knowledge-sheet';
import { useDocumentStats } from '@/lib/hooks/use-documents';
import { useThreads } from '@/features/chat/hooks/use-threads';
import { useModelSelector } from '@/features/chat/hooks/use-model-selector';
import { availableModels } from '@/lib/ai';
import { useUserProfile } from '@/features/chat/hooks/use-user-profile';
import { useChatSession } from '@/features/chat/hooks/use-chat-session';
import { ToolApprovalProvider } from '@/features/chat/contexts/tool-approval-context';
import { useMessageReactions } from '@/features/chat/hooks/use-message-reactions';
import { useChatKeyboardShortcuts } from '@/features/chat/hooks/use-chat-keyboard-shortcuts';
import { ChatHeader } from '@/features/chat/components/chat-header';
import { ChatComposer } from '@/features/chat/components/composer';
import { ChatMessageList, type FontSize } from '@/features/chat/components/message-list';
import { ChatSidebar } from '@/features/chat/components/chat-sidebar';
import { ConversationOutline } from '@/features/chat/components/conversation-outline';
import { ImageEditor } from '@/features/gallery/components/image-editor/image-editor';
import { useImageEditor } from '@/features/gallery/hooks/use-image-editor';
import { useAgents } from '@/features/agents/hooks/use-agents';
import { useChatVisibleAgents } from '@/features/agents/hooks/use-chat-visible-agents';
import { useComparePreset } from '@/features/chat/hooks/use-compare-preset';
import { CompareGrid, type ComparePrompt } from '@/features/chat/components/compare-grid';
import type { ChatMessage, QuizFollowUpContext, RoutingMetadata } from '@/features/chat/types';
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';
import { ThreadWorkingMemorySheet } from '@/features/memory/components/thread-working-memory-sheet';
import { consumePendingChatIntent } from '@/features/chat/lib/pending-chat-intent';
import { useUserPreferences } from '@/features/settings/hooks/use-user-preferences';

const GENERAL_STARTER_PROMPTS = [
  'ช่วยเขียนข้อความตอบลูกค้า LINE ที่ถามเรื่องราคาและการจัดส่ง',
  'ช่วยวาง 3 ไอเดียคอนเทนต์สำหรับธุรกิจของฉันในสัปดาห์นี้',
  'ช่วยเปลี่ยนไอเดียคร่าว ๆ นี้ให้เป็นร่างข้อความที่ส่งได้วันนี้',
];

export default function Chat() {
  return (
    <AppAccessGuard>
      <ChatShell />
    </AppAccessGuard>
  );
}

function ChatShell() {
  const [knowledgePanelOpen, setKnowledgePanelOpen] = useState(false);
  const [workingMemoryOpen, setWorkingMemoryOpen] = useState(false);
  const [outlinePanelOpen, setOutlinePanelOpen] = useState(false);
  const [widenMode, setWidenMode] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window === 'undefined') return 'base';
    return (localStorage.getItem('chat-font-size') as FontSize) ?? 'sm';
  });
  const handleChangeFontSize = useCallback((size: FontSize) => {
    setFontSize(size);
    localStorage.setItem('chat-font-size', size);
  }, []);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [activeOutlineMessageId, setActiveOutlineMessageId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [submittedComparePrompt, setSubmittedComparePrompt] = useState<ComparePrompt | null>(null);
  const [compareUserMessageId, setCompareUserMessageId] = useState<string>(() => crypto.randomUUID());
  const { presetIds, presetMode, toggleModel: toggleCompareModel, clearPreset: clearPresetIds } = useComparePreset();
  const clearPreset = useCallback(() => {
    clearPresetIds();
    setSubmittedComparePrompt(null);
  }, [clearPresetIds]);
  const handleToggleCompareMode = useCallback(() => {
    setCompareMode((prev) => !prev);
    if (compareMode) setSubmittedComparePrompt(null);
  }, [compareMode]);
  const { prefs } = useUserPreferences();

  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => consumePendingChatIntent()?.agentId ?? null);
  const latestQuizContextRef = useRef<QuizFollowUpContext | null>(null);
  const selectedDocIdsRef = useRef(selectedDocIds);
  selectedDocIdsRef.current = selectedDocIds;
  const useWebSearchRef = useRef(useWebSearch);
  useWebSearchRef.current = useWebSearch;
  const selectedAgentIdRef = useRef(selectedAgentId);
  selectedAgentIdRef.current = selectedAgentId;

  const { data: agentsData } = useAgents();
  const { isPersonalVisible, isEssentialVisible } = useChatVisibleAgents();
  const allAgents = agentsData?.agents ?? [];
  const allEssentials = agentsData?.essentials ?? [];
  const defaultEssentialAgent =
    allEssentials.find((agent) => agent.isDefault) ??
    allEssentials.find((agent) => agent.name.toLowerCase() === 'general assistant') ??
    null;
  // Personal agents: opt-in (green dot must be ON to appear in picker)
  // Essentials: opt-out (green dot is ON by default, user can turn off)
  const agents = allAgents.filter((a) => isPersonalVisible(a.id));
  const essentials = allEssentials.filter((a) => isEssentialVisible(a.id));
  const selectedAgent = [...allAgents, ...allEssentials].find((a) => a.id === selectedAgentId) ?? null;

  useEffect(() => {
    if (selectedAgentId !== null) return;
    if (!defaultEssentialAgent) return;

    setSelectedAgentId(defaultEssentialAgent.id);
  }, [defaultEssentialAgent, selectedAgentId]);

  const { data: docStats } = useDocumentStats();

  const {
    activeThreadId,
    activeThreadIdRef,
    setActiveThreadId,
    threads,
    isThreadsLoading,
    activeThread,
    activeMessages,
    createThreadMutation,
    pinThreadMutation,
    renameThreadMutation,
    deleteThreadMutation,
    handleCreateThread,
    ensureThread,
    queryClient,
  } = useThreads();

  const {
    selectedModel,
    setSelectedModel,
    selectedModelRef,
    enabledModelIdsRef,
    selectorModels,
    currentModel,
    modelSelectorOpen,
    setModelSelectorOpen,
  } = useModelSelector();

  const { sessionData, userProfile, isSigningOut, handleSignOut } = useUserProfile();

  const {
    messages,
    setMessages,
    status,
    error,
    stop,
    isSyncingFollowUpSuggestions,
    copiedMessageId,
    copyToClipboard,
    handleSubmitMessage,
    regenerateMessage,
    deleteMessage,
    handleExportConversation,
    handleTranscription,
    addToolApprovalResponse,
  } = useChatSession({
    activeThreadId,
    activeThreadIdRef,
    selectedModelRef,
    selectedDocIdsRef,
    enabledModelIdsRef,
    activeMessages,
    queryClient,
    ensureThread,
    useWebSearchRef,
    selectedAgentIdRef,
    followUpSuggestionsEnabled: prefs.followUpSuggestionsEnabled,
    latestQuizContextRef,
  });

  const { messageReactions, toggleReaction } = useMessageReactions(messages);

  const imageEditorState = useImageEditor();
  const { editorOpen, selectedAsset, openEditor, closeEditor } = imageEditorState;

  const lastRouting = useMemo((): RoutingMetadata | null => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'assistant' && message.metadata?.routing) {
        return message.metadata.routing;
      }
    }
    return null;
  }, [messages]);

  const lastRoutingModel = useMemo(() => {
    const matched = availableModels.find((model) => model.id === lastRouting?.modelId);
    if (!matched) {
      return undefined;
    }

    return {
      id: matched.id,
      name: matched.name,
    };
  }, [lastRouting]);

  const handleToggleSelectDoc = useCallback((docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const handleSelectModel = useCallback(
    (modelId: string) => {
      setSelectedModel(modelId);
      setModelSelectorOpen(false);
    },
    [setSelectedModel, setModelSelectorOpen]
  );

  // Reset model to 'auto' when activating an agent so the agent's configured
  // model isn't silently bypassed by a previously pinned manual selection.
  const handleSelectAgent = useCallback(
    (id: string | null) => {
      const nextAgentId = id ?? defaultEssentialAgent?.id ?? null;
      setSelectedAgentId(nextAgentId);
      if (nextAgentId !== null) setSelectedModel('auto');
    },
    [defaultEssentialAgent, setSelectedModel]
  );

  const handleToggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev);
  }, []);


  const handleCompareSubmit = useCallback(
    async ({ text }: PromptInputMessage) => {
      if (!text.trim() || presetIds.length < 2) return;
      await ensureThread();
      const newUserMessageId = crypto.randomUUID();
      setCompareUserMessageId(newUserMessageId);
      setSubmittedComparePrompt({
        text,
        groupId: crypto.randomUUID(),
        timestamp: Date.now(),
      });
    },
    [presetIds.length, ensureThread]
  );

  const handleCompareAllComplete = useCallback(
    (userMessage: import('@/features/chat/types').ChatMessage, assistantMessages: import('@/features/chat/types').ChatMessage[]) => {
      setMessages((prev) => [...prev, userMessage, ...assistantMessages]);
      setSubmittedComparePrompt(null);
      void queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
    [setMessages, queryClient]
  );

  const handleVoiceTurnComplete = useCallback(
    async (userText: string, aiText: string) => {
      const threadId = await ensureThread();
      await fetch('/api/voice-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, userText, aiText }),
      });

      // Fetch fresh messages and replace local state directly.
      // Avoids duplicates — invalidateQueries uses prefix matching and would
      // also refetch ['threads', threadId, 'messages'], creating duplicate IDs.
      const msgRes = await fetch(`/api/threads/${threadId}/messages`);
      const { messages: freshMessages } = await msgRes.json() as { messages: ChatMessage[] };
      setMessages(freshMessages);
      queryClient.setQueryData(['threads', threadId, 'messages'], freshMessages);

      // Exact: true — only refresh the sidebar thread list, not child queries.
      await queryClient.invalidateQueries({ queryKey: ['threads'], exact: true });
    },
    [ensureThread, queryClient, setMessages]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      handleSubmitMessage({ text: suggestion, files: [] });
    },
    [handleSubmitMessage]
  );

  const handleQuizStateChange = useCallback((context: QuizFollowUpContext) => {
    latestQuizContextRef.current = context;
  }, []);

  // Build voice history from current messages — text parts only, capped for context window
  const voiceHistory = useMemo(() => {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .flatMap((m) => {
        const rawParts = m.parts as unknown;
        const text = Array.isArray(rawParts)
          ? (rawParts as Array<Record<string, unknown>>)
              .filter((p) => p.type === 'text' && typeof p.text === 'string' && (p.text as string).trim())
              .map((p) => p.text as string)
              .join(' ')
              .trim()
          : typeof (m as unknown as { content?: string }).content === 'string'
            ? ((m as unknown as { content: string }).content).trim()
            : '';
        // Skip empty, tool-call JSON blobs, or bare punctuation
        if (!text || text.startsWith('{') || text.startsWith('`')) return [];
        return [{ role: m.role as 'user' | 'assistant', text }];
      });
  }, [messages]);

  useChatKeyboardShortcuts({
    onCreateThread: handleCreateThread,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f2f0fa,#e8e4f5_55%,#dddaf0_100%)] dark:bg-[radial-gradient(circle_at_top,#1c1a2e,#181628_55%,#141220_100%)] dark:font-light">
      <div className={`mx-auto flex min-h-screen w-full gap-3 px-2 py-2 transition-all duration-300 md:gap-6 md:px-4 md:py-6 ${widenMode ? 'w-full' : outlinePanelOpen ? 'max-w-360' : 'max-w-6xl'}`}>
        <ChatSidebar
          activeThreadId={activeThreadId}
          threads={threads}
          isLoading={isThreadsLoading}
          isCreatingThread={createThreadMutation.isPending}
          onSelectThread={setActiveThreadId}
          onCreateThread={handleCreateThread}
          onTogglePin={(threadId, pinned) => pinThreadMutation.mutate({ threadId, pinned })}
          onRenameThread={(threadId, title) => renameThreadMutation.mutate({ threadId, title })}
          onDeleteThread={(threadId) => deleteThreadMutation.mutate(threadId)}
          sessionData={sessionData}
          userProfile={userProfile}
          isSigningOut={isSigningOut}
          onSignOut={handleSignOut}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
          forceCollapsed={widenMode}
        />

        <main className="flex h-[calc(100dvh-1rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-black/5 dark:border-border bg-card/80 dark:bg-card/80 shadow-[0_35px_80px_-60px_rgba(15,23,42,0.5)] dark:shadow-[0_35px_80px_-60px_rgba(0,0,0,0.7)] backdrop-blur md:h-[calc(100vh-3rem)] md:rounded-3xl">
          {editorOpen && selectedAsset ? (
            <ImageEditor
              asset={selectedAsset}
              onClose={closeEditor}
              editorState={imageEditorState}
            />
          ) : (
            <>
              <ChatHeader
                activeThread={activeThread}
                status={status}
                lastRouting={lastRouting}
                lastRoutingModel={lastRoutingModel}
                onDeleteThread={(threadId) => deleteThreadMutation.mutate(threadId)}
                isDeleting={deleteThreadMutation.isPending}
                onExport={handleExportConversation}
                knowledgePanelOpen={knowledgePanelOpen}
                onToggleKnowledgePanel={() => setKnowledgePanelOpen((v) => !v)}
                workingMemoryOpen={workingMemoryOpen}
                onToggleWorkingMemory={() => setWorkingMemoryOpen((v) => !v)}
                outlinePanelOpen={outlinePanelOpen}
                onToggleOutlinePanel={() => setOutlinePanelOpen((v) => !v)}
                widenMode={widenMode}
                onToggleWidenMode={() => setWidenMode((v) => !v)}
                fontSize={fontSize}
                onChangeFontSize={handleChangeFontSize}
                docCount={docStats?.totalDocuments ?? 0}
                onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
              />

              <ToolApprovalProvider value={addToolApprovalResponse}>
                <ChatMessageList
                  messages={messages}
                  status={status}
                  threadId={activeThreadId ?? undefined}
                  activeMessageId={activeOutlineMessageId}
                  isSyncingFollowUpSuggestions={isSyncingFollowUpSuggestions}
                  copiedMessageId={copiedMessageId}
                  messageReactions={messageReactions}
                  fontSize={fontSize}
                  agentName={selectedAgent?.name}
                  agentDescription={selectedAgent?.description}
                  starterPrompts={selectedAgent?.starterPrompts}
                  generalStarterPrompts={GENERAL_STARTER_PROMPTS}
                  onCopyMessage={copyToClipboard}
                  onRegenerateMessage={regenerateMessage}
                  onDeleteMessage={deleteMessage}
                  onToggleReaction={toggleReaction}
                  onSuggestionClick={handleSuggestionClick}
                  onImageClick={openEditor}
                  onQuizStateChange={handleQuizStateChange}
                  onActiveMessageChange={setActiveOutlineMessageId}
                />
              </ToolApprovalProvider>
              {compareMode && (
                <div className="border-t border-black/5 dark:border-border overflow-auto">
                  <CompareGrid
                    modelIds={presetIds}
                    submittedPrompt={submittedComparePrompt}
                    threadId={activeThreadId ?? ''}
                    userMessageId={compareUserMessageId}
                    onAllComplete={handleCompareAllComplete}
                  />
                </div>
              )}

              <ChatComposer
                selectedDocCount={selectedDocIds.size}
                status={status}
                error={error}
                selectedModel={selectedModel}
                selectorModels={selectorModels}
                currentModel={currentModel}
                modelSelectorOpen={modelSelectorOpen}
                useWebSearch={useWebSearch}
                agents={agents}
                essentials={essentials}
                selectedAgentId={selectedAgentId}
                onSelectAgent={handleSelectAgent}
                onStop={stop}
                onModelSelectorOpenChange={setModelSelectorOpen}
                onSelectModel={handleSelectModel}
                onToggleWebSearch={handleToggleWebSearch}
                onSuggestionClick={handleSuggestionClick}
                onTranscriptionChange={handleTranscription}
                onSubmit={compareMode ? handleCompareSubmit : handleSubmitMessage}
                onVoiceTurnComplete={handleVoiceTurnComplete}
                voiceHistory={voiceHistory}
                selectedVoice={prefs.selectedVoice}
                compareMode={compareMode}
                comparePresetIds={presetIds}
                comparePresetMode={presetMode}
                onToggleCompareMode={handleToggleCompareMode}
                onToggleCompareModel={toggleCompareModel}
                onClearComparePreset={clearPreset}
              />

              <ThreadWorkingMemorySheet
                open={workingMemoryOpen}
                onOpenChange={setWorkingMemoryOpen}
                threadId={activeThreadId || null}
                threadTitle={activeThread?.title}
              />

              <KnowledgeSheet
                open={knowledgePanelOpen}
                onOpenChange={setKnowledgePanelOpen}
                selectedDocIds={selectedDocIds}
                onToggleSelect={handleToggleSelectDoc}
                totalDocuments={docStats?.totalDocuments}
              />
            </>
          )}
        </main>

        {outlinePanelOpen && (
          <div className="hidden lg:block">
            <ConversationOutline
              messages={messages}
              activeMessageId={activeOutlineMessageId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
