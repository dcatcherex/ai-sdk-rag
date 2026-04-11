'use client';

import type {
  WorkspaceAiRunsOverview,
  WorkspaceImageAssistRequest,
  WorkspaceImageAssistResult,
  WorkspaceTextAssistKind,
  WorkspaceTextAssistResult,
} from './types';

type ApiErrorPayload = {
  error?: string;
};

async function parseJson<T>(response: Response): Promise<T & ApiErrorPayload> {
  return response.json() as Promise<T & ApiErrorPayload>;
}

export async function requestWorkspaceTextAssist(
  kind: WorkspaceTextAssistKind,
  body: Record<string, unknown>,
): Promise<WorkspaceTextAssistResult> {
  const response = await fetch('/api/workspace-ai/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, ...body }),
  });

  const json = await parseJson<WorkspaceTextAssistResult>(response);
  if (!response.ok) {
    throw new Error(json.error ?? 'AI assist failed');
  }

  return json;
}

export async function requestWorkspaceImageAssist(
  body: WorkspaceImageAssistRequest,
): Promise<WorkspaceImageAssistResult> {
  const response = await fetch('/api/workspace-ai/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await parseJson<WorkspaceImageAssistResult>(response);
  if (!response.ok) {
    throw new Error(json.error ?? 'AI image assist failed');
  }

  return json;
}

export async function requestWorkspaceAiRunsOverview(
  limit = 20,
): Promise<WorkspaceAiRunsOverview> {
  const searchParams = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`/api/workspace-ai/runs?${searchParams.toString()}`);

  const json = await parseJson<WorkspaceAiRunsOverview>(response);
  if (!response.ok) {
    throw new Error(json.error ?? 'Failed to fetch workspace AI activity');
  }

  return json;
}
