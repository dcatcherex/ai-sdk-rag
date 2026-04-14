'use client';

import { useState } from 'react';
import type { ToolManifest } from '@/features/tools/registry/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateGoogleSlidesDeck,
  useCreateGoogleSlidesFromTemplate,
} from '@/features/google-slides/hooks/use-google-slides';
import {
  useDisconnectGoogleWorkspace,
  useGoogleWorkspaceStatus,
} from '@/features/google-workspace/hooks/use-google-workspace';

type Props = { manifest: ToolManifest };

export function GoogleSlidesToolPage({ manifest }: Props) {
  const statusQuery = useGoogleWorkspaceStatus();
  const disconnectMutation = useDisconnectGoogleWorkspace();
  const createDeckMutation = useCreateGoogleSlidesDeck();
  const createFromTemplateMutation = useCreateGoogleSlidesFromTemplate();

  const [folderId, setFolderId] = useState('');
  const [title, setTitle] = useState('P5 Science Review Deck');
  const [templatePresentationId, setTemplatePresentationId] = useState('');
  const [templateTitle, setTemplateTitle] = useState('Copied Workshop Deck');
  const [slidesJson, setSlidesJson] = useState(
    '[\n  {\n    "title": "Plant Life Cycle",\n    "bullets": ["Seed", "Sprout", "Adult plant", "Flowering"],\n    "speakerNotes": "Use a real flower example from class."\n  },\n  {\n    "title": "Review Quiz",\n    "bullets": ["What does a seed need?", "Name two plant parts."],\n    "speakerNotes": "Pause for answers before revealing examples."\n  }\n]',
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const latestResult = createFromTemplateMutation.data ?? createDeckMutation.data;

  const parseSlides = () =>
    (
      JSON.parse(slidesJson) as Array<{
        title: string;
        bullets?: string[];
        speakerNotes?: string;
        imagePrompt?: string;
      }>
    ).map((slide) => ({
      title: slide.title,
      bullets: slide.bullets ?? [],
      speakerNotes: slide.speakerNotes,
      imagePrompt: slide.imagePrompt,
    }));

  const handleCreateDeck = async () => {
    setLocalError(null);
    try {
      await createDeckMutation.mutateAsync({
        title,
        slides: parseSlides(),
        folderId: folderId || undefined,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Deck creation failed');
    }
  };

  const handleCreateFromTemplate = async () => {
    setLocalError(null);
    try {
      await createFromTemplateMutation.mutateAsync({
        templatePresentationId,
        title: templateTitle,
        slides: parseSlides(),
        folderId: folderId || undefined,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Template deck creation failed');
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
            Google Slides Control Room
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Generate simple lesson and workshop decks from structured outlines, or
            copy a template presentation and append new slides that match its theme.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href="/api/integrations/google/connect?returnTo=/tools/google-slides"
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
            <h2 className="text-base font-medium">Create Deck</h2>
            <div className="mt-3 space-y-3">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Presentation title"
              />
              <Input
                value={folderId}
                onChange={(event) => setFolderId(event.target.value)}
                placeholder="Drive folder ID (optional)"
              />
              <Textarea
                value={slidesJson}
                onChange={(event) => setSlidesJson(event.target.value)}
                rows={16}
              />
              <Button
                onClick={handleCreateDeck}
                disabled={createDeckMutation.isPending || !title || !slidesJson}
              >
                Create Google Slides Deck
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border p-5">
            <h2 className="text-base font-medium">Create from Template</h2>
            <div className="mt-3 space-y-3">
              <Input
                value={templatePresentationId}
                onChange={(event) => setTemplatePresentationId(event.target.value)}
                placeholder="Template presentation ID"
              />
              <Input
                value={templateTitle}
                onChange={(event) => setTemplateTitle(event.target.value)}
                placeholder="Copied presentation title"
              />
              <Button
                onClick={handleCreateFromTemplate}
                disabled={
                  createFromTemplateMutation.isPending ||
                  !templatePresentationId ||
                  !templateTitle
                }
              >
                Copy Template and Append Slides
              </Button>
              <p className="text-xs text-muted-foreground">
                This copies the template deck first, then appends the generated slides so
                the new deck inherits the template theme without low-level layout editing.
              </p>
            </div>
          </section>
        </div>

        {(localError || createDeckMutation.error || createFromTemplateMutation.error) && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {localError ??
              createDeckMutation.error?.message ??
              createFromTemplateMutation.error?.message}
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
