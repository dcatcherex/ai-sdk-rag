'use client';

import { useState } from 'react';
import type { ToolManifest } from '@/features/tools/registry/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useAppendGoogleDocSection,
  useCreateGoogleDoc,
  useCreateGoogleDocFromTemplate,
} from '@/features/google-docs/hooks/use-google-docs';
import {
  useDisconnectGoogleWorkspace,
  useGoogleWorkspaceStatus,
} from '@/features/google-workspace/hooks/use-google-workspace';

type Props = { manifest: ToolManifest };

export function GoogleDocsToolPage({ manifest }: Props) {
  const statusQuery = useGoogleWorkspaceStatus();
  const disconnectMutation = useDisconnectGoogleWorkspace();
  const createMutation = useCreateGoogleDoc();
  const createFromTemplateMutation = useCreateGoogleDocFromTemplate();
  const appendMutation = useAppendGoogleDocSection();

  const [folderId, setFolderId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [title, setTitle] = useState('P5 Science Homework');
  const [markdown, setMarkdown] = useState(
    '# Lesson Goals\n\n- Understand plant life cycles\n- Practice key vocabulary\n\n## Homework\nAnswer questions 1-5 in full sentences.',
  );
  const [templateDocumentId, setTemplateDocumentId] = useState('');
  const [templateTitle, setTemplateTitle] = useState('Workshop Handout Copy');
  const [replacementsJson, setReplacementsJson] = useState(
    '{\n  "class_name": "P5/2",\n  "topic": "Plant Life Cycle",\n  "due_date": "2026-04-21"\n}',
  );
  const [appendHeading, setAppendHeading] = useState('Answer Key');
  const [appendMarkdown, setAppendMarkdown] = useState(
    '1. Seeds need water, soil, and sunlight.\n2. A plant grows from a seed into a mature plant.',
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const latestResult =
    appendMutation.data ??
    createFromTemplateMutation.data ??
    createMutation.data;

  const handleCreateFromTemplate = async () => {
    setLocalError(null);
    try {
      await createFromTemplateMutation.mutateAsync({
        templateDocumentId,
        title: templateTitle,
        replacements: JSON.parse(replacementsJson) as Record<string, string>,
        folderId: folderId || undefined,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Template action failed');
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <div className="rounded-3xl border bg-background/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {manifest.title}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Google Docs Control Room
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Create handouts, worksheets, and structured documents using the same
            service layer agents will use for teacher and admin workflows.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href="/api/integrations/google/connect?returnTo=/tools/google-docs"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Connect Google
            </a>
            <Button
              variant="outline"
              onClick={() => void statusQuery.refetch()}
              disabled={statusQuery.isFetching}
            >
              Refresh Status
            </Button>
            <Button
              variant="outline"
              onClick={() => void disconnectMutation.mutateAsync()}
              disabled={disconnectMutation.isPending || !statusQuery.data?.connected}
            >
              Disconnect
            </Button>
          </div>
          <div className="mt-4 rounded-2xl border p-4 text-sm">
            <div className="font-medium">
              {statusQuery.data?.configured ? 'OAuth configured' : 'OAuth not configured'}
            </div>
            <div className="mt-1 text-muted-foreground">
              {statusQuery.data?.connected
                ? `Connected as ${statusQuery.data.account?.email ?? statusQuery.data.account?.displayName ?? 'Google account'}`
                : 'No Google account connected yet.'}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border p-5">
            <h2 className="text-base font-medium">Create Document from Markdown</h2>
            <div className="mt-3 space-y-3">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Document title"
              />
              <Input
                value={folderId}
                onChange={(event) => setFolderId(event.target.value)}
                placeholder="Drive folder ID (optional)"
              />
              <Textarea
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                rows={12}
              />
              <Button
                onClick={() =>
                  void createMutation
                    .mutateAsync({
                      title,
                      contentMarkdown: markdown,
                      folderId: folderId || undefined,
                    })
                    .then((result) => {
                      const payload = result as { data?: { documentId?: string } } | undefined;
                      const nextDocumentId = payload?.data?.documentId;
                      if (nextDocumentId) setDocumentId(nextDocumentId);
                    })
                }
                disabled={createMutation.isPending || !title || !markdown}
              >
                Create Google Doc
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border p-5">
            <h2 className="text-base font-medium">Create from Template</h2>
            <div className="mt-3 space-y-3">
              <Input
                value={templateDocumentId}
                onChange={(event) => setTemplateDocumentId(event.target.value)}
                placeholder="Template document ID"
              />
              <Input
                value={templateTitle}
                onChange={(event) => setTemplateTitle(event.target.value)}
                placeholder="New document title"
              />
              <Textarea
                value={replacementsJson}
                onChange={(event) => setReplacementsJson(event.target.value)}
                rows={10}
              />
              <Button
                onClick={handleCreateFromTemplate}
                disabled={
                  createFromTemplateMutation.isPending ||
                  !templateDocumentId ||
                  !templateTitle
                }
              >
                Create from Template
              </Button>
              <p className="text-xs text-muted-foreground">
                Use `{'{{placeholder}}'}` tokens in the source template and provide a JSON
                object mapping placeholder names to replacement text.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border p-5 md:col-span-2">
            <h2 className="text-base font-medium">Append Section</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
              <Input
                value={documentId}
                onChange={(event) => setDocumentId(event.target.value)}
                placeholder="Document ID"
              />
              <Input
                value={appendHeading}
                onChange={(event) => setAppendHeading(event.target.value)}
                placeholder="Optional heading"
              />
            </div>
            <Textarea
              className="mt-3"
              value={appendMarkdown}
              onChange={(event) => setAppendMarkdown(event.target.value)}
              rows={8}
            />
            <Button
              className="mt-3"
              onClick={() =>
                void appendMutation.mutateAsync({
                  documentId,
                  heading: appendHeading || undefined,
                  contentMarkdown: appendMarkdown,
                })
              }
              disabled={appendMutation.isPending || !documentId || !appendMarkdown}
            >
              Append Section
            </Button>
          </section>
        </div>

        {(localError ||
          createMutation.error ||
          createFromTemplateMutation.error ||
          appendMutation.error) && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {localError ??
              createMutation.error?.message ??
              createFromTemplateMutation.error?.message ??
              appendMutation.error?.message}
          </div>
        )}

        <section className="rounded-2xl border p-5">
          <h2 className="text-base font-medium">Latest Result</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-muted/50 p-4 text-xs">
            {JSON.stringify(
              latestResult ?? statusQuery.data ?? { message: 'No result yet' },
              null,
              2,
            )}
          </pre>
        </section>
      </div>
    </div>
  );
}
