import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { mediaAsset, toolArtifact, toolRun } from '@/db/schema';
import { validateUrl } from '@/lib/security/ssrfProtection';
import { createDriveFolder, listDriveFiles, uploadDriveFile } from '@/lib/google/drive';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import type {
  CreateDriveFolderInput,
  ListDriveFilesInput,
  UploadFileToDriveInput,
} from './schema';

async function createPendingToolRun(userId: string, inputJson: unknown) {
  const id = nanoid();
  await db.insert(toolRun).values({
    id,
    toolSlug: 'google-drive',
    userId,
    source: 'manual',
    inputJson,
    status: 'pending',
  });
  return id;
}

async function completeToolRun(runId: string, outputJson: unknown) {
  await db.update(toolRun).set({
    status: 'completed',
    outputJson,
    completedAt: new Date(),
  }).where(eq(toolRun.id, runId));
}

async function failToolRun(runId: string, message: string) {
  await db.update(toolRun).set({
    status: 'failed',
    errorMessage: message,
    completedAt: new Date(),
  }).where(eq(toolRun.id, runId));
}

async function resolveUploadSource(input: UploadFileToDriveInput, userId: string) {
  if (input.fileUrl) {
    return {
      url: input.fileUrl,
      fileName: input.fileName ?? `vaja-file-${Date.now()}`,
      mimeType: input.mimeType ?? 'application/octet-stream',
    };
  }

  if (input.mediaAssetId) {
    const asset = await db
      .select()
      .from(mediaAsset)
      .where(and(eq(mediaAsset.id, input.mediaAssetId), eq(mediaAsset.userId, userId)))
      .limit(1);

    if (!asset[0]) throw new Error('Media asset not found');

    return {
      url: asset[0].url,
      fileName: input.fileName ?? `${asset[0].id}.${asset[0].mimeType.split('/')[1] ?? 'bin'}`,
      mimeType: input.mimeType ?? asset[0].mimeType,
    };
  }

  if (input.artifactId) {
    const artifact = await db
      .select({
        id: toolArtifact.id,
        storageUrl: toolArtifact.storageUrl,
        format: toolArtifact.format,
      })
      .from(toolArtifact)
      .innerJoin(toolRun, eq(toolArtifact.toolRunId, toolRun.id))
      .where(and(eq(toolArtifact.id, input.artifactId), eq(toolRun.userId, userId)))
      .limit(1);

    if (!artifact[0]?.storageUrl) throw new Error('Tool artifact not found or has no storage URL');

    return {
      url: artifact[0].storageUrl,
      fileName: input.fileName ?? `${artifact[0].id}.${artifact[0].format}`,
      mimeType: input.mimeType ?? 'application/octet-stream',
    };
  }

  throw new Error('No upload source provided');
}

export async function runListDriveFiles(input: ListDriveFilesInput, userId: string) {
  return listDriveFiles(userId, input);
}

export async function runCreateDriveFolder(input: CreateDriveFolderInput, userId: string) {
  return createDriveFolder(userId, input);
}

export async function runUploadFileToDrive(input: UploadFileToDriveInput, userId: string) {
  const source = await resolveUploadSource(input, userId);
  const validation = validateUrl(source.url);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid file URL');
  }

  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Failed to download source file: ${await response.text()}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = source.mimeType || response.headers.get('content-type') || 'application/octet-stream';

  return uploadDriveFile(userId, {
    fileName: source.fileName,
    mimeType,
    fileBuffer: Buffer.from(arrayBuffer),
    folderId: input.folderId,
  });
}

export async function listDriveFilesAction(
  input: ListDriveFilesInput,
  userId: string,
): Promise<ToolExecutionResult> {
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runListDriveFiles(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_drive',
      runId,
      title: 'List Google Drive files',
      summary: `${data.files?.length ?? 0} files returned`,
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list files';
    await failToolRun(runId, message);
    throw error;
  }
}

export async function createDriveFolderAction(
  input: CreateDriveFolderInput,
  userId: string,
): Promise<ToolExecutionResult> {
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runCreateDriveFolder(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_drive',
      runId,
      title: `Create folder ${input.name}`,
      summary: `Folder ${data.name} created`,
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create folder';
    await failToolRun(runId, message);
    throw error;
  }
}

export async function uploadFileToDriveAction(
  input: UploadFileToDriveInput,
  userId: string,
): Promise<ToolExecutionResult> {
  const runId = await createPendingToolRun(userId, input);
  try {
    const data = await runUploadFileToDrive(input, userId);
    await completeToolRun(runId, data);
    return {
      tool: 'google_drive',
      runId,
      title: `Upload ${data.name}`,
      summary: 'File uploaded to Google Drive',
      data,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload file';
    await failToolRun(runId, message);
    throw error;
  }
}
