import { renderHtmlToPdf } from "@/lib/export/html-to-pdf";
import type { PdfExportRequest, PdfExportResult } from "@/lib/export/types";

export async function exportPdfDocument(request: PdfExportRequest): Promise<PdfExportResult> {
  if (request.htmlSource) {
    const htmlPdfBuffer = await renderHtmlToPdf(request.htmlSource);

    if (htmlPdfBuffer) {
      return {
        buffer: htmlPdfBuffer,
        contentType: "application/pdf",
        filename: request.filename,
        renderer: "html",
      };
    }
  }

  const fallbackResult = await request.fallback();

  return {
    buffer: fallbackResult.buffer,
    contentType: "application/pdf",
    filename: fallbackResult.filename,
    renderer: "programmatic",
  };
}
