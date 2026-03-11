/**
 * Precise Document Extractor
 *
 * Uses a vision LLM to extract document content with exact page numbers,
 * section titles, and structured tables — preserving source traceability.
 */

import { generateText } from 'ai';

export const DEFAULT_PRECISE_MODEL = 'google/gemini-3.1-flash-lite-preview';

const PRECISE_SYSTEM = `You are a precise document extractor. Read a document and extract its content into structured JSON chunks, preserving all factual content with exact source location metadata.

Return a JSON object with this exact shape:
{
  "totalPages": <integer or null>,
  "chunks": [
    {
      "page": <page number as integer, or null if not a PDF or unknown>,
      "section": "<the nearest heading or section title above this content, or empty string>",
      "content": "<the full extracted text for this logical section, with tables as GitHub-flavored markdown>"
    }
  ]
}

EXTRACTION RULES:
1. One chunk = one logical section. A section boundary is defined by: a heading change, a page break combined with topic change, or a standalone table.
2. page: Use the page number printed in the document footer/header if present, otherwise count pages sequentially from 1.
3. section: Use the exact heading text from the document. If no heading exists for a block, use the nearest parent heading. If no headings at all, use empty string.
4. content: Extract ALL text verbatim — do NOT summarize, rephrase, or omit any words. Preserve numbers, dates, names, and technical terms exactly.
5. Tables: Convert to GitHub Flavored Markdown table syntax (| col1 | col2 |). Preserve all cell values exactly.
6. Do NOT include: running headers/footers that repeat the document title, or decorative separators.
7. If the document is plain text with no headings, create one chunk per ~800 words, setting section to empty string.

Return ONLY the JSON object. Do not wrap in markdown code fences.`;

export interface PreciseChunk {
  content: string;
  page: number | null;
  section: string;
  chunkIndex: number;
}

export interface PreciseExtractionResult {
  chunks: PreciseChunk[];
  totalPages: number | null;
  modelId: string;
}

const VISUAL_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
]);

export async function extractDocumentPrecise(
  fileBytes: Uint8Array,
  mimeType: string,
  modelId: string,
  fileName: string,
): Promise<PreciseExtractionResult> {
  const isVisual = VISUAL_MIME_TYPES.has(mimeType);

  const { text } = await generateText({
    model: modelId,
    system: PRECISE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: isVisual
          ? [
              { type: 'file', data: fileBytes, mediaType: mimeType as any },
              { type: 'text', text: `Extract the document "${fileName}" into structured JSON chunks following the instructions.` },
            ]
          : [
              {
                type: 'text',
                text: `Extract the following document "${fileName}" into structured JSON chunks following the instructions.\n\nDocument content:\n${new TextDecoder().decode(fileBytes)}`,
              },
            ],
      },
    ],
  });

  let raw = text.trim().replace(/^```json?\n?|```$/g, '').trim();

  try {
    const parsed = JSON.parse(raw);
    const rawChunks: Array<{ page?: number | null; section?: string; content?: string }> =
      Array.isArray(parsed.chunks) ? parsed.chunks : [];

    const chunks: PreciseChunk[] = rawChunks
      .filter((c) => typeof c.content === 'string' && c.content.trim())
      .map((c, i) => ({
        content: c.content!.trim(),
        page: typeof c.page === 'number' ? c.page : null,
        section: typeof c.section === 'string' ? c.section.trim() : '',
        chunkIndex: i,
      }));

    if (chunks.length === 0) {
      throw new Error('No chunks extracted from document');
    }

    return {
      chunks,
      totalPages: typeof parsed.totalPages === 'number' ? parsed.totalPages : null,
      modelId,
    };
  } catch {
    throw new Error('Failed to parse precise extraction response from AI');
  }
}
