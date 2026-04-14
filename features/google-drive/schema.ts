import { z } from 'zod';

export const uploadFileToDriveInputSchema = z.object({
  artifactId: z.string().optional(),
  mediaAssetId: z.string().optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  folderId: z.string().optional(),
}).refine(
  (value) => Boolean(value.artifactId || value.mediaAssetId || value.fileUrl),
  'One of artifactId, mediaAssetId, or fileUrl is required.',
);

export const createDriveFolderInputSchema = z.object({
  name: z.string().min(1).max(120),
  parentFolderId: z.string().optional(),
});

export const listDriveFilesInputSchema = z.object({
  folderId: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export type UploadFileToDriveInput = z.infer<typeof uploadFileToDriveInputSchema>;
export type CreateDriveFolderInput = z.infer<typeof createDriveFolderInputSchema>;
export type ListDriveFilesInput = z.infer<typeof listDriveFilesInputSchema>;
