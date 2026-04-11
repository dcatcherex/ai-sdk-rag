'use client';

import type { ChatRunDetail, ChatRunsOverview } from './audit/types';

type ApiErrorPayload = {
  error?: string;
};

async function parseJson<T>(response: Response): Promise<T & ApiErrorPayload> {
  return response.json() as Promise<T & ApiErrorPayload>;
}

export async function requestChatRunsOverview(limit = 20): Promise<ChatRunsOverview> {
  const searchParams = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`/api/chat-runs?${searchParams.toString()}`);
  const json = await parseJson<ChatRunsOverview>(response);

  if (!response.ok) {
    throw new Error(json.error ?? 'Failed to fetch chat activity');
  }

  return json;
}

export async function requestChatRun(runId: string): Promise<ChatRunDetail> {
  const response = await fetch(`/api/chat-runs/${runId}`);
  const json = await parseJson<ChatRunDetail>(response);

  if (!response.ok) {
    throw new Error(json.error ?? 'Failed to fetch chat run');
  }

  return json;
}
