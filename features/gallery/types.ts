export type MediaAsset = {
  id: string;
  type: string;
  url: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType: string;
  threadId: string;
  messageId: string;
  parentAssetId?: string | null;
  rootAssetId?: string | null;
  version?: number | null;
  editPrompt?: string | null;
  createdAtMs: number;
};
