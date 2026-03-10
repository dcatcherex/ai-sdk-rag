'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatSidebar } from '@/features/chat/components/chat-sidebar';
import { useThreads, setNewChatIntent, setPendingThread } from '@/features/chat/hooks/use-threads';
import { useUserProfile } from '@/features/chat/hooks/use-user-profile';
import { AgentsList } from '@/features/agents/components/agents-list';

export default function AgentsPage() {
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f7f7f9,#eef0f7_55%,#e6e9f2_100%)] dark:bg-[radial-gradient(circle_at_top,#1a1b2e,#111827_55%,#0f172a_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-3 px-2 py-2 md:gap-6 md:px-4 md:py-6">
        <ChatSidebar
          activeThreadId={activeThreadId}
          threads={threads}
          isLoading={isThreadsLoading}
          isCreatingThread={createThreadMutation.isPending}
          onSelectThread={(threadId) => { setPendingThread(threadId); router.push('/'); }}
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
          <AgentsList />
        </main>
      </div>
    </div>
  );
}
