/**
 * Document Analysis
 *
 * Analyzes documents using heuristics to detect noise, estimate size,
 * and recommend the best storage mode (RAG vs context injection).
 */

export interface NoisySection {
  label: string;
  matchedPattern: string;
  confidence: 'heuristic';
  charCount: number;
}

export interface DocumentAnalysis {
  wordCount: number;
  charCount: number;
  estimatedTokens: number;
  noisySections: NoisySection[];
  noiseRatio: number;
  recommendRAG: boolean;
  storageModeReason: string;
  isImageBased: boolean;
  /** Set when a context-mode document is large enough to risk "context rot" */
  contextSizeWarning: string | null;
}

// Heuristic patterns that identify common noise sections by heading name
const NOISE_PATTERNS: Array<{ label: string; pattern: RegExp; estimatedChars: number }> = [
  { label: 'Table of Contents', pattern: /^(table of contents|contents)\s*$/im, estimatedChars: 600 },
  { label: 'Preface', pattern: /^preface\s*$/im, estimatedChars: 800 },
  { label: 'Foreword', pattern: /^foreword\s*$/im, estimatedChars: 800 },
  { label: 'Acknowledgements', pattern: /^acknowledg(e?ments?)\s*$/im, estimatedChars: 400 },
  { label: 'Dedication', pattern: /^dedication\s*$/im, estimatedChars: 200 },
  { label: 'Bibliography', pattern: /^bibliography\s*$/im, estimatedChars: 1200 },
  { label: 'References', pattern: /^references\s*$/im, estimatedChars: 1200 },
  { label: 'Index', pattern: /^index\s*$/im, estimatedChars: 1000 },
  { label: 'Copyright Notice', pattern: /copyright\s+©?\s*\d{4}/im, estimatedChars: 300 },
  { label: 'Legal Boilerplate', pattern: /all rights reserved|no part of this (publication|book|document)/im, estimatedChars: 400 },
  { label: 'Publisher Info', pattern: /isbn[\s-]?\d[\d\s-]{9,}/im, estimatedChars: 200 },
  { label: 'About the Author', pattern: /^about the author\s*$/im, estimatedChars: 500 },
  { label: 'Abstract', pattern: /^abstract\s*$/im, estimatedChars: 400 },
];

// Context injection threshold — based on 2026 RAG vs Long-Context research:
// Documents under ~40,000 tokens (160,000 chars) are better served by direct
// context injection than by chunking: no fragmentation, better holistic reasoning.
const CONTEXT_INJECTION_THRESHOLD = 160_000;

// Caution threshold: documents over ~25,000 tokens (100,000 chars) in context mode
// may cause issues when combined with conversation history and multiple selected docs.
// Warn the user so they can monitor total context size.
const CONTEXT_CAUTION_CHARS = 100_000;

// Effective limit for Claude Opus 4.6: ~130,000 tokens (520,000 chars).
// Beyond this, "context rot" degrades model reasoning even within the advertised limit.
const EFFECTIVE_CONTEXT_LIMIT_CHARS = 520_000;

/**
 * Quick check: is this an image file type?
 */
export const IMAGE_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

export function isImageFileType(ext: string): boolean {
  return ext.toLowerCase() in IMAGE_MIME_TYPES;
}

/**
 * Detect if a PDF is image-based by checking extracted text density.
 * fileSizeBytes / 100KB gives a rough page estimate.
 */
export function detectImageBasedPdf(extractedText: string, fileSizeBytes: number): boolean {
  const estimatedPages = Math.max(fileSizeBytes / (100 * 1024), 1);
  const charsPerPage = extractedText.length / estimatedPages;
  return charsPerPage < 100;
}

export function analyzeDocument(content: string, isImageBased = false): DocumentAnalysis {
  const charCount = content.length;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const estimatedTokens = Math.round(charCount / 4);

  // Detect noisy sections via heuristics
  const noisySections: NoisySection[] = [];
  for (const { label, pattern, estimatedChars } of NOISE_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      noisySections.push({
        label,
        matchedPattern: match[0].trim(),
        confidence: 'heuristic',
        charCount: estimatedChars,
      });
    }
  }

  // Estimate noise ratio
  const totalNoiseChars = noisySections.reduce((sum, s) => sum + s.charCount, 0);
  const noiseRatio = charCount > 0 ? Math.min(totalNoiseChars / charCount, 0.9) : 0;

  // Estimate cleaned size and recommend storage mode
  const estimatedCleanedChars = charCount * (1 - noiseRatio);
  const recommendRAG = estimatedCleanedChars > CONTEXT_INJECTION_THRESHOLD;

  const cleanedTokens = Math.round(estimatedCleanedChars / 4);
  const storageModeReason = recommendRAG
    ? `~${cleanedTokens.toLocaleString()} tokens — exceeds the 40,000-token injection threshold, RAG chunking recommended`
    : `~${cleanedTokens.toLocaleString()} tokens — within the safe context injection window (under 40,000 tokens)`;

  // Effective context limit warning (applies to context-mode docs only)
  let contextSizeWarning: string | null = null;
  if (!recommendRAG) {
    if (estimatedCleanedChars > EFFECTIVE_CONTEXT_LIMIT_CHARS) {
      // Exceeds Claude Opus 4.6's effective reasoning threshold (~130K tokens)
      contextSizeWarning =
        `This document (~${cleanedTokens.toLocaleString()} tokens) exceeds the effective context limit for Claude (~130,000 tokens). ` +
        `"Context rot" may degrade reasoning quality. Switch to RAG mode for reliable results.`;
    } else if (estimatedCleanedChars > CONTEXT_CAUTION_CHARS) {
      // Large enough that selecting multiple docs simultaneously may cause issues
      const tokenStr = cleanedTokens.toLocaleString();
      contextSizeWarning =
        `Large document (~${tokenStr} tokens) in context mode. If you select multiple documents simultaneously, ` +
        `monitor total context size — combined usage may approach model limits.`;
    }
  }

  return {
    wordCount,
    charCount,
    estimatedTokens,
    noisySections,
    noiseRatio,
    recommendRAG,
    storageModeReason,
    isImageBased,
    contextSizeWarning,
  };
}
