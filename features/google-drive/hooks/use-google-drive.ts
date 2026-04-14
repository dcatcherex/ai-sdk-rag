'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  CreateDriveFolderInput,
  ListDriveFilesInput,
  UploadFileToDriveInput,
} from '@/features/google-drive/schema';

type MediaAssetRecord = {
  id: string;
  type: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  mimeType: string;
  threadId: string | null;
  messageId: string | null;
  parentAssetId?: string | null;
  rootAssetId?: string | null;
  version?: number | null;
  editPrompt?: string | null;
  createdAt: string | Date;
  createdAtMs: number;
};

type ToolArtifactRecord = {
  id: string;
  kind: string;
  format: string;
  storageUrl: string | null;
  payloadJson: unknown;
  createdAt: string | Date;
  createdAtMs: number;
  toolRunId: string;
  toolSlug: string;
};

async function postJson<TInput, TOutput>(url: string, input: TInput): Promise<TOutput> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<TOutput>;
}

export function useListGoogleDriveFiles() {
  return useMutation({
    mutationFn: (input: ListDriveFilesInput) =>
      postJson('/api/tools/google-drive/list-files', input),
  });
}

export function useCreateGoogleDriveFolder() {
  return useMutation({
    mutationFn: (input: CreateDriveFolderInput) =>
      postJson('/api/tools/google-drive/create-folder', input),
  });
}

export function useUploadFileToGoogleDrive() {
  return useMutation({
    mutationFn: (input: UploadFileToDriveInput) =>
      postJson('/api/tools/google-drive/upload', input),
  });
}

export function useRecentMediaAssets(limit = 24) {
  return useQuery({
    queryKey: ['recent-media-assets', limit],
    queryFn: async () => {
      const response = await fetch(`/api/media-assets?limit=${limit}`);
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { assets: MediaAssetRecord[] };
      return data.assets;
    },
  });
}

export function useRecentToolArtifacts(limit = 24) {
  return useQuery({
    queryKey: ['recent-tool-artifacts', limit],
    queryFn: async () => {
      const response = await fetch(`/api/tool-artifacts?limit=${limit}`);
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { artifacts: ToolArtifactRecord[] };
      return data.artifacts;
    },
  });
}
