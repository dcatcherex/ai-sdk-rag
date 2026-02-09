'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
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
import type { ChatMessage, RoutingMetadata } from '@/features/chat/types';

export default function Chat() {
  const [searchQuery, setSearchQuery] = useState('');
  const [knowledgePanelOpen, setKnowledgePanelOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const selectedDocIdsRef = useRef(selectedDocIds);
  selectedDocIdsRef.current = selectedDocIds;

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
    deleteThreadMutation,
    handleCreateThread,
    ensureThread,
    queryClient,
  } = useThreads();

  const {
    selectedModel,
    setSelectedModel,
    selectedModelRef,
    enabledModelIds,
    enabledModelIdsRef,
    selectorModels,
    currentModel,
    modelSelectorOpen,
    setModelSelectorOpen,
    enabledModelsOpen,
    setEnabledModelsOpen,
    handleToggleModel,
  } = useModelSelector();

  const { sessionData, userProfile, isSigningOut, handleSignOut } = useUserProfile();

  const {
    messages,
    status,
    error,
    stop,
    copiedMessageId,
    copyToClipboard,
    handleSubmitMessage,
    regenerateMessage,
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
  });

  const { messageReactions, toggleReaction } = useMessageReactions(messages);

  const lastRouting = useMemo((): RoutingMetadata | null => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'assistant' && message.metadata?.routing) {
        return message.metadata.routing;
      }
    }
    return null;
  }, [messages]);

  const lastRoutingModel = useMemo(
    () => availableModels.find((model) => model.id === lastRouting?.modelId),
    [lastRouting]
  );

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

  useChatKeyboardShortcuts({
    onCreateThread: handleCreateThread,
    searchQuery,
    setSearchQuery,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7f7f9,_#eef0f7_55%,_#e6e9f2_100%)]">
      <div className={`mx-auto flex min-h-screen w-full gap-3 px-2 py-2 md:gap-6 md:px-4 md:py-6 ${knowledgePanelOpen ? 'max-w-[90rem]' : 'max-w-6xl'}`}>
        <ChatSidebar
          activeThreadId={activeThreadId}
          threads={threads}
          isLoading={isThreadsLoading}
          isCreatingThread={createThreadMutation.isPending}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectThread={setActiveThreadId}
          onCreateThread={handleCreateThread}
          onTogglePin={(threadId, pinned) => pinThreadMutation.mutate({ threadId, pinned })}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
        />

        <main className="flex h-[calc(100dvh-1rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-black/5 bg-white/80 shadow-[0_35px_80px_-60px_rgba(15,23,42,0.5)] backdrop-blur md:h-[calc(100vh-3rem)] md:rounded-3xl">
          <ChatHeader
            activeThread={activeThread}
            status={status}
            sessionData={sessionData}
            userProfile={userProfile}
            isSigningOut={isSigningOut}
            onSignOut={handleSignOut}
            currentModel={currentModel}
            selectedModel={selectedModel}
            selectorModels={selectorModels}
            modelSelectorOpen={modelSelectorOpen}
            enabledModelsOpen={enabledModelsOpen}
            enabledModelIds={enabledModelIds}
            onModelSelectorOpenChange={setModelSelectorOpen}
            onEnabledModelsOpenChange={setEnabledModelsOpen}
            onSelectModel={handleSelectModel}
            onToggleModel={handleToggleModel}
            lastRouting={lastRouting}
            lastRoutingModel={lastRoutingModel}
            onDeleteThread={(threadId) => deleteThreadMutation.mutate(threadId)}
            isDeleting={deleteThreadMutation.isPending}
            onExport={handleExportConversation}
            knowledgePanelOpen={knowledgePanelOpen}
            onToggleKnowledgePanel={() => setKnowledgePanelOpen((v) => !v)}
            docCount={docStats?.totalDocuments ?? 0}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          />

          <ChatMessageList
            messages={messages}
            status={status}
            copiedMessageId={copiedMessageId}
            messageReactions={messageReactions}
            onCopyMessage={copyToClipboard}
            onRegenerateMessage={regenerateMessage}
            onToggleReaction={toggleReaction}
          />

          <ChatComposer
            selectedDocCount={selectedDocIds.size}
            status={status}
            error={error}
            onStop={stop}
            onTranscriptionChange={handleTranscription}
            onSubmit={handleSubmitMessage}
          />
        </main>

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