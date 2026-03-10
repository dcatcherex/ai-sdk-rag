'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatSidebar } from '@/features/chat/components/chat-sidebar';
import { useThreads, setNewChatIntent, setPendingThread } from '@/features/chat/hooks/use-threads';
import { useUserProfile } from '@/features/chat/hooks/use-user-profile';
import { useTemplates } from '@/features/certificate/hooks/use-templates';
import { TemplateSelector } from '@/features/certificate/components/template-selector';
import { TemplateUploader } from '@/features/certificate/components/template-uploader';
import { FieldConfigurator } from '@/features/certificate/components/field-configurator';
import { CertificateForm } from '@/features/certificate/components/certificate-form';
import { BatchForm } from '@/features/certificate/components/batch-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CertificateTemplate } from '@/features/certificate/types';

type View = 'list' | 'upload' | 'configure';

export default function CertificatePage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [view, setView] = useState<View>('list');

  const {
    activeThreadId, setActiveThreadId, threads, isThreadsLoading,
    createThreadMutation, pinThreadMutation, renameThreadMutation, deleteThreadMutation,
  } = useThreads();

  const { sessionData, userProfile, isSigningOut, handleSignOut } = useUserProfile();
  const { data: templates = [], isLoading: templatesLoading } = useTemplates();

  function handleSelectTemplate(t: CertificateTemplate) {
    setSelectedTemplate(t);
    setView('list');
  }

  function handleUploadDone(t: CertificateTemplate) {
    setSelectedTemplate(t);
    setView('configure');
  }

  function handleFieldsSaved(t: CertificateTemplate) {
    setSelectedTemplate(t);
    setView('list');
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f2f0fa,#e8e4f5_55%,#dddaf0_100%)] dark:bg-[radial-gradient(circle_at_top,#1a1b2e,#16142b_55%,#120f26_100%)]">
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

        <main className="flex h-[calc(100dvh-1rem)] flex-1 flex-col overflow-y-auto rounded-2xl border border-black/5 dark:border-white/10 bg-card/80 dark:bg-card/80 shadow-[0_35px_80px_-60px_rgba(15,23,42,0.5)] dark:shadow-[0_35px_80px_-60px_rgba(0,0,0,0.7)] backdrop-blur md:h-[calc(100vh-3rem)] md:rounded-3xl">
          <div className="space-y-6 p-4 md:p-6">
            <div>
              <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Certificate Generator</h1>
              <p className="text-sm text-zinc-500">Create and batch-export certificates from your templates.</p>
            </div>

            {/* Template list / upload / configure */}
            {view === 'upload' ? (
              <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700 md:p-6">
                <TemplateUploader onDone={handleUploadDone} onCancel={() => setView('list')} />
              </div>
            ) : view === 'configure' && selectedTemplate ? (
              <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700 md:p-6">
                <FieldConfigurator template={selectedTemplate} onSaved={handleFieldsSaved} />
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700 md:p-6">
                {templatesLoading ? (
                  <p className="text-sm text-zinc-400">Loading templates…</p>
                ) : (
                  <TemplateSelector
                    templates={templates}
                    selectedId={selectedTemplate?.id ?? null}
                    onSelect={handleSelectTemplate}
                    onUploadClick={() => setView('upload')}
                  />
                )}
              </div>
            )}

            {/* Configure fields button for selected template */}
            {view === 'list' && selectedTemplate && (
              <>
                <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-2 dark:bg-indigo-950/30">
                  <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    Selected: <span className="font-bold">{selectedTemplate.name}</span>
                  </p>
                  <button
                    onClick={() => setView('configure')}
                    className="text-xs font-medium text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-400"
                  >
                    Configure fields
                  </button>
                </div>

                <Tabs defaultValue="single" className="w-full">
                  <TabsList>
                    <TabsTrigger value="single">Single</TabsTrigger>
                    <TabsTrigger value="batch">Batch</TabsTrigger>
                  </TabsList>
                  <TabsContent value="single" className="pt-4">
                    <CertificateForm template={selectedTemplate} />
                  </TabsContent>
                  <TabsContent value="batch" className="pt-4">
                    <BatchForm template={selectedTemplate} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
