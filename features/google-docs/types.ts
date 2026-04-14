export type GoogleDocReplacementMap = Record<string, string>;

export type GoogleDocCreateResult = {
  documentId: string;
  title: string;
  mimeType: string;
  webViewLink: string | null;
  folderId: string | null;
};
