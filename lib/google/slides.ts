import { ensureGoogleAccessToken, ensureGoogleScopes } from '@/lib/google/oauth';

const SLIDES_SCOPE = 'https://www.googleapis.com/auth/presentations';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_SLIDES_MIME_TYPE = 'application/vnd.google-apps.presentation';

type SlideInput = {
  title: string;
  bullets: string[];
  speakerNotes?: string;
  imagePrompt?: string;
};

type SlidePage = {
  objectId: string;
  slideProperties?: {
    notesPage?: {
      notesProperties?: {
        speakerNotesObjectId?: string;
      };
    };
  };
};

type SlidesBatchRequest = Record<string, unknown>;

async function googleSlidesFetch<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
  const { account, accessToken } = await ensureGoogleAccessToken(userId);
  ensureGoogleScopes(account, [SLIDES_SCOPE]);

  const res = await fetch(`https://slides.googleapis.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Google Slides API failed: ${await res.text()}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

async function createDriveBackedPresentation(
  userId: string,
  input: { title: string; folderId?: string },
) {
  const { account, accessToken } = await ensureGoogleAccessToken(userId);
  ensureGoogleScopes(account, [SLIDES_SCOPE, DRIVE_FILE_SCOPE]);

  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.title,
        mimeType: GOOGLE_SLIDES_MIME_TYPE,
        parents: input.folderId ? [input.folderId] : undefined,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Google Slides creation failed: ${await res.text()}`);
  }

  return (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    parents?: string[];
  };
}

async function copyPresentationTemplate(
  userId: string,
  input: { templatePresentationId: string; title: string; folderId?: string },
) {
  const { account, accessToken } = await ensureGoogleAccessToken(userId);
  ensureGoogleScopes(account, [SLIDES_SCOPE, DRIVE_FILE_SCOPE]);

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.templatePresentationId)}/copy?fields=id,name,mimeType,webViewLink,parents`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.title,
        parents: input.folderId ? [input.folderId] : undefined,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Google Slides template copy failed: ${await res.text()}`);
  }

  return (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    parents?: string[];
  };
}

export async function getGooglePresentation(
  userId: string,
  presentationId: string,
) {
  return googleSlidesFetch<{
    presentationId: string;
    title: string;
    slides?: SlidePage[];
  }>(userId, `presentations/${encodeURIComponent(presentationId)}`);
}

export async function batchUpdateGooglePresentation(
  userId: string,
  presentationId: string,
  requests: SlidesBatchRequest[],
) {
  if (requests.length === 0) {
    return { presentationId };
  }

  return googleSlidesFetch<{ presentationId: string }>(
    userId,
    `presentations/${encodeURIComponent(presentationId)}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({ requests }),
    },
  );
}

function buildCreateSlideRequests(
  slides: SlideInput[],
  existingSlideCount: number,
) {
  const requests: SlidesBatchRequest[] = [];

  slides.forEach((slide, index) => {
    const position = existingSlideCount + index;
    const slideId = `vaja_slide_${position + 1}_${Date.now()}_${index}`;
    const titleId = `${slideId}_title`;
    const bodyId = `${slideId}_body`;
    const bodyLines = [...slide.bullets];

    if (slide.imagePrompt?.trim()) {
      bodyLines.push(`Image cue: ${slide.imagePrompt.trim()}`);
    }

    requests.push({
      createSlide: {
        objectId: slideId,
        insertionIndex: position,
        slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
        placeholderIdMappings: [
          {
            layoutPlaceholder: { type: 'TITLE', index: 0 },
            objectId: titleId,
          },
          {
            layoutPlaceholder: { type: 'BODY', index: 0 },
            objectId: bodyId,
          },
        ],
      },
    });

    requests.push({
      insertText: {
        objectId: titleId,
        insertionIndex: 0,
        text: slide.title,
      },
    });

    if (bodyLines.length > 0) {
      requests.push({
        insertText: {
          objectId: bodyId,
          insertionIndex: 0,
          text: bodyLines.join('\n'),
        },
      });
      requests.push({
        createParagraphBullets: {
          objectId: bodyId,
          textRange: {
            type: 'ALL',
          },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    }
  });

  return requests;
}

function buildSpeakerNotesRequests(
  pages: SlidePage[],
  slides: SlideInput[],
) {
  const requests: SlidesBatchRequest[] = [];

  slides.forEach((slide, index) => {
    const notesId = pages[index]?.slideProperties?.notesPage?.notesProperties?.speakerNotesObjectId;
    if (!notesId || !slide.speakerNotes?.trim()) return;

    requests.push({
      insertText: {
        objectId: notesId,
        insertionIndex: 0,
        text: slide.speakerNotes.trim(),
      },
    });
  });

  return requests;
}

async function appendSlidesToPresentation(
  userId: string,
  presentationId: string,
  slides: SlideInput[],
) {
  const before = await getGooglePresentation(userId, presentationId);
  const existingCount = before.slides?.length ?? 0;

  await batchUpdateGooglePresentation(
    userId,
    presentationId,
    buildCreateSlideRequests(slides, existingCount),
  );

  const after = await getGooglePresentation(userId, presentationId);
  const createdPages = (after.slides ?? []).slice(existingCount);
  const notesRequests = buildSpeakerNotesRequests(createdPages, slides);

  await batchUpdateGooglePresentation(userId, presentationId, notesRequests);

  return {
    presentationId,
    title: after.title,
    slideCount: after.slides?.length ?? existingCount + slides.length,
    createdSlideCount: slides.length,
  };
}

export async function createGoogleSlidesDeck(
  userId: string,
  input: { title: string; slides: SlideInput[]; folderId?: string },
) {
  const created = await createDriveBackedPresentation(userId, input);
  const populated = await appendSlidesToPresentation(userId, created.id, input.slides);

  return {
    presentationId: created.id,
    title: created.name,
    mimeType: created.mimeType,
    webViewLink: created.webViewLink ?? null,
    folderId: created.parents?.[0] ?? input.folderId ?? null,
    slideCount: populated.slideCount,
    createdSlideCount: populated.createdSlideCount,
  };
}

export async function createGoogleSlidesFromTemplate(
  userId: string,
  input: {
    templatePresentationId: string;
    title: string;
    slides: SlideInput[];
    folderId?: string;
  },
) {
  const copied = await copyPresentationTemplate(userId, input);
  const populated = await appendSlidesToPresentation(userId, copied.id, input.slides);

  return {
    presentationId: copied.id,
    title: copied.name,
    mimeType: copied.mimeType,
    webViewLink: copied.webViewLink ?? null,
    folderId: copied.parents?.[0] ?? input.folderId ?? null,
    slideCount: populated.slideCount,
    createdSlideCount: populated.createdSlideCount,
  };
}
