'use client';

import { useState } from 'react';
import type { ToolManifest } from '@/features/tools/registry/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useCreateGoogleDriveFolder,
  useListGoogleDriveFiles,
  useRecentMediaAssets,
  useRecentToolArtifacts,
  useUploadFileToGoogleDrive,
} from '@/features/google-drive/hooks/use-google-drive';
import {
  useDisconnectGoogleWorkspace,
  useGoogleWorkspaceStatus,
} from '@/features/google-workspace/hooks/use-google-workspace';

type Props = { manifest: ToolManifest };

export function GoogleDriveToolPage({ manifest }: Props) {
  const statusQuery = useGoogleWorkspaceStatus();
  const disconnectMutation = useDisconnectGoogleWorkspace();
  const listMutation = useListGoogleDriveFiles();
  const createFolderMutation = useCreateGoogleDriveFolder();
  const uploadMutation = useUploadFileToGoogleDrive();
  const mediaAssetsQuery = useRecentMediaAssets();
  const toolArtifactsQuery = useRecentToolArtifacts();

  const [folderId, setFolderId] = useState('');
  const [query, setQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('Teaching Materials');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState('');
  const [selectedArtifactId, setSelectedArtifactId] = useState('');

  const latestResult =
    uploadMutation.data ??
    createFolderMutation.data ??
    listMutation.data;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="rounded-3xl border bg-background/80 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {manifest.title}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Google Drive Control Room
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Test Drive folder creation, listing, and uploads from the same service
          layer that agents will use to archive generated materials and export files.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href="/api/integrations/google/connect?returnTo=/tools/google-drive"
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
          <h2 className="text-base font-medium">List Files</h2>
          <div className="mt-3 space-y-3">
            <Input
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
              placeholder="Folder ID (optional)"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name contains... (optional)"
            />
            <Button
              onClick={() => void listMutation.mutateAsync({ folderId: folderId || undefined, query: query || undefined, limit: 20 })}
              disabled={listMutation.isPending}
            >
              List Files
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border p-5">
          <h2 className="text-base font-medium">Create Folder</h2>
          <div className="mt-3 space-y-3">
            <Input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Folder name"
            />
            <Button
              onClick={() => void createFolderMutation.mutateAsync({ name: newFolderName, parentFolderId: folderId || undefined })}
              disabled={createFolderMutation.isPending || !newFolderName}
            >
              Create Folder
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border p-5 md:col-span-2">
          <h2 className="text-base font-medium">Upload from URL</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input
              value={fileUrl}
              onChange={(event) => setFileUrl(event.target.value)}
              placeholder="https://..."
            />
            <Input
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder="Optional file name"
            />
            <Input
              value={mimeType}
              onChange={(event) => setMimeType(event.target.value)}
              placeholder="Optional mime type"
            />
            <div className="flex items-end">
              <Button
              onClick={() =>
                  void uploadMutation.mutateAsync(
                    selectedMediaAssetId
                      ? {
                          mediaAssetId: selectedMediaAssetId,
                          fileName: fileName || undefined,
                          mimeType: mimeType || undefined,
                          folderId: folderId || undefined,
                        }
                      : selectedArtifactId
                        ? {
                            artifactId: selectedArtifactId,
                            fileName: fileName || undefined,
                            mimeType: mimeType || undefined,
                            folderId: folderId || undefined,
                          }
                        : {
                            fileUrl,
                            fileName: fileName || undefined,
                            mimeType: mimeType || undefined,
                            folderId: folderId || undefined,
                          }
                  )
                }
                disabled={
                  uploadMutation.isPending ||
                  (!fileUrl && !selectedMediaAssetId && !selectedArtifactId)
                }
              >
                Upload File
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            You can upload from a direct URL, a recent `mediaAsset`, or a recent
            `toolArtifact`. Selecting an asset or artifact will take priority over
            the URL field.
          </p>
        </section>

        <section className="rounded-2xl border p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-medium">Recent Media Assets</h2>
            <Button variant="outline" size="sm" onClick={() => void mediaAssetsQuery.refetch()}>
              Refresh
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {(mediaAssetsQuery.data ?? []).slice(0, 8).map((asset) => (
              <button
                key={asset.id}
                type="button"
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm ${
                  selectedMediaAssetId === asset.id ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => {
                  setSelectedMediaAssetId(asset.id);
                  setSelectedArtifactId('');
                  setFileUrl(asset.url);
                  setFileName(fileName || asset.id);
                  setMimeType(asset.mimeType);
                }}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{asset.id}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {asset.type} • {asset.mimeType}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(asset.createdAtMs).toLocaleDateString()}
                </span>
              </button>
            ))}
            {mediaAssetsQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent media assets found.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-medium">Recent Tool Artifacts</h2>
            <Button variant="outline" size="sm" onClick={() => void toolArtifactsQuery.refetch()}>
              Refresh
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {(toolArtifactsQuery.data ?? []).slice(0, 8).map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm ${
                  selectedArtifactId === artifact.id ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => {
                  setSelectedArtifactId(artifact.id);
                  setSelectedMediaAssetId('');
                  if (artifact.storageUrl) setFileUrl(artifact.storageUrl);
                  setFileName(fileName || `${artifact.id}.${artifact.format}`);
                }}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{artifact.id}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {artifact.toolSlug} • {artifact.kind}/{artifact.format}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(artifact.createdAtMs).toLocaleDateString()}
                </span>
              </button>
            ))}
            {toolArtifactsQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent tool artifacts found.</p>
            )}
          </div>
        </section>
      </div>

      {(listMutation.error || createFolderMutation.error || uploadMutation.error || mediaAssetsQuery.error || toolArtifactsQuery.error) && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {listMutation.error?.message ??
            createFolderMutation.error?.message ??
            uploadMutation.error?.message ??
            mediaAssetsQuery.error?.message ??
            toolArtifactsQuery.error?.message}
        </div>
      )}

      <section className="rounded-2xl border p-5">
        <h2 className="text-base font-medium">Latest Result</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-muted/50 p-4 text-xs">
          {JSON.stringify(latestResult ?? statusQuery.data ?? { message: 'No result yet' }, null, 2)}
        </pre>
      </section>
      </div>
    </div>
  );
}
