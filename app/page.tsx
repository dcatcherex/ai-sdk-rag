'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KnowledgePanel } from '@/components/knowledge/knowledge-panel';
import { useDocumentStats } from '@/lib/hooks/use-documents';
import { useThreads } from '@/features/chat/hooks/use-threads';
import { useModelSelector } from '@/features/chat/hooks/use-model-selector';
import { availableModels } from '@/lib/ai';
import { useUserProfile } from '@/features/chat/hooks/use-user-profile';
import { useChatSession } from '@/features/chat/hooks/use-chat-session';
import { useMessageReactions } from '@/features/chat/hooks/use-message-reactions';
import { useChatKeyboardShortcuts } from '@/features/chat/hooks/use-chat-keyboard-shortcuts';
import { ChatHeader } from '@/features/chat/components/chat-header';
import { ChatComposer } from '@/features/chat/components/chat-composer';
import { ChatMessageList } from '@/features/chat/components/chat-message-list';
import { ChatSidebar } from '@/features/chat/components/chat-sidebar';
import { ConversationOutline } from '@/features/chat/components/conversation-outline';
import { ImageEditor } from '@/features/gallery/components/image-editor/image-editor';
import { useImageEditor } from '@/features/gallery/hooks/use-image-editor';
import { useAgents } from '@/features/agents/hooks/use-agents';
import { useComparePreset } from '@/features/chat/hooks/use-compare-preset';
import { CompareGrid, type ComparePrompt } from '@/features/chat/components/compare-grid';
import type { ChatMessage, RoutingMetadata } from '@/features/chat/types';
import type { SystemPromptKey } from '@/lib/prompt';
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';

export default function Chat() {
  const [knowledgePanelOpen, setKnowledgePanelOpen] = useState(false);
  const [outlinePanelOpen, setOutlinePanelOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
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
  const [followUpSuggestionsEnabled, setFollowUpSuggestionsEnabled] = useState(true);
  useEffect(() => {
    void fetch('/api/user/preferences')
      .then((r) => r.ok ? r.json() : null)
      .then((prefs) => { if (prefs) setFollowUpSuggestionsEnabled(prefs.followUpSuggestionsEnabled ?? true); });
  }, []);

  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const selectedDocIdsRef = useRef(selectedDocIds);
  selectedDocIdsRef.current = selectedDocIds;
  const useWebSearchRef = useRef(useWebSearch);
  useWebSearchRef.current = useWebSearch;
  const selectedAgentIdRef = useRef(selectedAgentId);
  selectedAgentIdRef.current = selectedAgentId;

  const { data: agents = [] } = useAgents();

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
    followUpSuggestionsEnabled,
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

  const lastPersona = useMemo((): SystemPromptKey | null => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'assistant' && message.metadata?.persona) {
        return message.metadata.persona ?? null;
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7f7f9,_#eef0f7_55%,_#e6e9f2_100%)] dark:bg-[radial-gradient(circle_at_top,_#1a1b2e,_#111827_55%,_#0f172a_100%)]">
      <div className={`mx-auto flex min-h-screen w-full gap-3 px-2 py-2 md:gap-6 md:px-4 md:py-6 ${knowledgePanelOpen || outlinePanelOpen ? 'max-w-[90rem]' : 'max-w-6xl'}`}>
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
        />

        <main className="flex h-[calc(100dvh-1rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 shadow-[0_35px_80px_-60px_rgba(15,23,42,0.5)] dark:shadow-[0_35px_80px_-60px_rgba(0,0,0,0.7)] backdrop-blur md:h-[calc(100vh-3rem)] md:rounded-3xl">
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
                lastPersona={lastPersona}
                onDeleteThread={(threadId) => deleteThreadMutation.mutate(threadId)}
                isDeleting={deleteThreadMutation.isPending}
                onExport={handleExportConversation}
                knowledgePanelOpen={knowledgePanelOpen}
                onToggleKnowledgePanel={() => setKnowledgePanelOpen((v) => !v)}
                outlinePanelOpen={outlinePanelOpen}
                onToggleOutlinePanel={() => setOutlinePanelOpen((v) => !v)}
                docCount={docStats?.totalDocuments ?? 0}
                onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
              />

              <ChatMessageList
                messages={messages}
                status={status}
                threadId={activeThreadId ?? undefined}
                isSyncingFollowUpSuggestions={isSyncingFollowUpSuggestions}
                copiedMessageId={copiedMessageId}
                messageReactions={messageReactions}
                onCopyMessage={copyToClipboard}
                onRegenerateMessage={regenerateMessage}
                onDeleteMessage={deleteMessage}
                onToggleReaction={toggleReaction}
                onSuggestionClick={handleSuggestionClick}
                onImageClick={openEditor}
              />
              {compareMode && (
                <div className="border-t border-black/5 dark:border-white/10 overflow-auto">
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
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
                onStop={stop}
                onModelSelectorOpenChange={setModelSelectorOpen}
                onSelectModel={handleSelectModel}
                onToggleWebSearch={handleToggleWebSearch}
                onSuggestionClick={handleSuggestionClick}
                onTranscriptionChange={handleTranscription}
                onSubmit={compareMode ? handleCompareSubmit : handleSubmitMessage}
                onVoiceTurnComplete={handleVoiceTurnComplete}
                voiceHistory={voiceHistory}
                compareMode={compareMode}
                comparePresetIds={presetIds}
                comparePresetMode={presetMode}
                onToggleCompareMode={handleToggleCompareMode}
                onToggleCompareModel={toggleCompareModel}
                onClearComparePreset={clearPreset}
              />
            </>
          )}
        </main>

        {outlinePanelOpen && (
          <div className="hidden lg:block">
            <ConversationOutline messages={messages} />
          </div>
        )}

        {knowledgePanelOpen && (
          <div className="hidden h-[calc(100vh-3rem)] lg:block">
            <KnowledgePanel
              selectedDocIds={selectedDocIds}
              onToggleSelect={handleToggleSelectDoc}
            />
          </div>
        )}
      </div>
    </div>
  );
}