export type ExportDocumentKind = "quiz";

export type PdfRenderer = "html" | "programmatic";

export type ExportMimeType = "application/pdf";

export type HtmlPdfSource = {
  headers?: Record<string, string>;
  pageFormat?: "A4" | "Letter";
  preferCssPageSize?: boolean;
  printBackground?: boolean;
  url: string;
};

export type ProgrammaticPdfResult = {
  buffer: Buffer;
  filename: string;
};

export type PdfFallbackRenderer = () => Promise<ProgrammaticPdfResult>;

export type PdfExportRequest = {
  documentKind: ExportDocumentKind;
  fallback: PdfFallbackRenderer;
  filename: string;
  htmlSource?: HtmlPdfSource;
};

export type PdfExportResult = {
  buffer: Buffer;
  contentType: ExportMimeType;
  filename: string;
  renderer: PdfRenderer;
};
