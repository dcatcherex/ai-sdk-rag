import { GoogleGenAI } from '@google/genai';
import { generateText } from 'ai';
import { DEFAULT_PRECISE_MODEL, extractDocumentPrecise } from '@/lib/document-precise';
import { transcriptionModel } from '@/lib/ai';

export type LineMediaAnalysis = {
  extractedText: string;
  summary: string;
  modelId: string;
  kind: 'vision' | 'transcription' | 'text' | 'unsupported';
};

const TEXT_DECODER = new TextDecoder();
const GEMINI_TRANSCRIPTION_PROMPT =
  'Transcribe this audio accurately, preserving the original language including Thai. Return only the spoken words.';
const LINE_MEDIA_SUMMARY_SYSTEM = `You analyze customer support attachments from LINE.
Summarize only what is clearly present in the extracted content.
Keep the summary short, factual, and useful for a support agent.
Return plain text only.`;

const TEXT_LIKE_EXTENSIONS: Record<string, string> = {
  csv: 'text/csv',
  json: 'application/json',
  md: 'text/markdown',
  txt: 'text/plain',
  xml: 'application/xml',
};

const DOCUMENT_EXTENSIONS: Record<string, string> = {
  pdf: 'application/pdf',
  ...TEXT_LIKE_EXTENSIONS,
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

const getGeminiClient = (): GoogleGenAI | null => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const getExtension = (fileName: string): string | null => {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() ?? null;
};

const resolveFileMimeType = (fileName: string): string | null => {
  const extension = getExtension(fileName);
  if (!extension) {
    return null;
  }
  return DOCUMENT_EXTENSIONS[extension] ?? IMAGE_EXTENSIONS[extension] ?? null;
};

const buildSummary = async (extractedText: string, fileName: string, modelId: string): Promise<string> => {
  const trimmed = extractedText.trim();
  if (!trimmed) {
    return '';
  }

  const result = await generateText({
    model: modelId,
    system: LINE_MEDIA_SUMMARY_SYSTEM,
    prompt: [
      `Attachment: ${fileName}`,
      'Extracted content:',
      trimmed.length > 6000 ? `${trimmed.slice(0, 6000)}\n…` : trimmed,
      '',
      'Write a short support-facing summary now.',
    ].join('\n'),
  });

  return result.text.trim();
};

export const analyzeLineImage = async (options: {
  fileBytes: Uint8Array;
  mimeType: string;
  fileName: string;
}): Promise<LineMediaAnalysis | null> => {
  const extraction = await extractDocumentPrecise(
    options.fileBytes,
    options.mimeType,
    DEFAULT_PRECISE_MODEL,
    options.fileName,
  );

  const extractedText = extraction.chunks.map((chunk) => chunk.content).join('\n\n').trim();
  if (!extractedText) {
    return null;
  }

  const summary = await buildSummary(extractedText, options.fileName, extraction.modelId);

  return {
    extractedText,
    summary,
    modelId: extraction.modelId,
    kind: 'vision',
  };
};

export const analyzeLineFile = async (options: {
  fileBytes: Uint8Array;
  fileName: string;
}): Promise<LineMediaAnalysis | null> => {
  const mimeType = resolveFileMimeType(options.fileName);
  if (!mimeType) {
    return null;
  }

  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') {
    const extractedText = TEXT_DECODER.decode(options.fileBytes).trim();
    if (!extractedText) {
      return null;
    }

    const summary = await buildSummary(extractedText, options.fileName, DEFAULT_PRECISE_MODEL);
    return {
      extractedText,
      summary,
      modelId: DEFAULT_PRECISE_MODEL,
      kind: 'text',
    };
  }

  const extraction = await extractDocumentPrecise(options.fileBytes, mimeType, DEFAULT_PRECISE_MODEL, options.fileName);
  const extractedText = extraction.chunks.map((chunk) => chunk.content).join('\n\n').trim();
  if (!extractedText) {
    return null;
  }

  const summary = await buildSummary(extractedText, options.fileName, extraction.modelId);

  return {
    extractedText,
    summary,
    modelId: extraction.modelId,
    kind: 'vision',
  };
};

export const analyzeLineAudio = async (options: {
  fileBytes: Uint8Array;
  mimeType: string;
}): Promise<LineMediaAnalysis | null> => {
  const client = getGeminiClient();
  if (!client) {
    return null;
  }

  const response = await client.models.generateContent({
    model: transcriptionModel.replace('google/', ''),
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: options.mimeType,
              data: Buffer.from(options.fileBytes).toString('base64'),
            },
          },
          {
            text: GEMINI_TRANSCRIPTION_PROMPT,
          },
        ],
      },
    ],
  });

  const extractedText = response.text?.trim() ?? '';
  if (!extractedText) {
    return null;
  }

  return {
    extractedText,
    summary: extractedText,
    modelId: transcriptionModel,
    kind: 'transcription',
  };
};
