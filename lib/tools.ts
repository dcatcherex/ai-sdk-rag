/**
 * Backward-compatible re-exports.
 * New code should import from '@/lib/tools/index' or individual domain files.
 */
import type { ToolSet, InferUITools } from 'ai';
import { weatherTools } from './tools/weather';
import { ragTools } from './tools/rag';
import { createExamPrepTools } from './tools/exam-prep';

export { buildToolSet } from './tools/index';
export { weatherTools, ragTools, createExamPrepTools };

const examPrepTools = createExamPrepTools();

/** baseTools: weather only (no RAG) — used by legacy callers */
export const baseTools = { ...weatherTools } satisfies ToolSet;

/** All tools combined — kept for InferUITools type derivation */
export const tools = {
  ...weatherTools,
  ...ragTools,
  ...examPrepTools,
} satisfies ToolSet;

export type ChatTools = InferUITools<typeof tools>;
