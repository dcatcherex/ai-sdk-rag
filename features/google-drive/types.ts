export type GoogleDriveUploadSource =
  | { fileUrl: string; fileName?: string; mimeType?: string; folderId?: string }
  | { mediaAssetId: string; fileName?: string; mimeType?: string; folderId?: string }
  | { artifactId: string; fileName?: string; mimeType?: string; folderId?: string };
