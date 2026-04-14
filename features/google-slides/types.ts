export type GoogleSlidesDeckSummary = {
  presentationId: string;
  title: string;
  mimeType: string;
  webViewLink: string | null;
  folderId: string | null;
  slideCount: number;
  createdSlideCount: number;
};
