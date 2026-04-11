import 'server-only';

import { generateText, Output } from 'ai';
import { availableModels } from '@/lib/ai';
import { IMAGE_MODEL_CONFIGS, resolveImageCredits } from '@/features/image/types';
import { triggerImageGeneration } from '@/features/image/service';
import {
  workspaceTextAssistOutputSchema,
  type WorkspaceImageAssistRequestInput,
  type WorkspaceTextAssistRequestInput,
} from './schema';
import { buildWorkspaceImageAssistPrompt, buildWorkspaceTextAssistPrompt } from './prompts';
import type {
  WorkspaceImageAssistRequest,
  WorkspaceImageAssistResult,
  WorkspaceTextAssistKind,
  WorkspaceTextAssistRequest,
  WorkspaceTextAssistResult,
} from './types';

const WORKSPACE_TEXT_ASSIST_MODEL = 'google/gemini-2.5-flash-lite';
const WORKSPACE_IMAGE_ASSIST_MODEL = 'nano-banana-2';

function getWorkspaceAssistModel(kind: WorkspaceTextAssistKind): string {
  switch (kind) {
    case 'agent-description':
    case 'agent-starters':
    case 'skill-description':
      return WORKSPACE_TEXT_ASSIST_MODEL;
  }
}

function ensureModelExists(modelId: string): string {
  return availableModels.some((model) => model.id === modelId)
    ? modelId
    : WORKSPACE_TEXT_ASSIST_MODEL;
}

function ensureImageModelExists(modelId?: string): string {
  if (modelId && IMAGE_MODEL_CONFIGS.some((config) => config.id === modelId)) {
    return modelId;
  }
  return WORKSPACE_IMAGE_ASSIST_MODEL;
}

function normalizeSuggestions(values: string[], maxSuggestions: number): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
    if (normalized.length >= maxSuggestions) break;
  }

  return normalized;
}

export async function runWorkspaceTextAssist(
  input: WorkspaceTextAssistRequestInput,
): Promise<WorkspaceTextAssistResult> {
  const typedInput = input as WorkspaceTextAssistRequest;
  const promptConfig = buildWorkspaceTextAssistPrompt(typedInput);
  const modelId = ensureModelExists(getWorkspaceAssistModel(input.kind));

  const { output } = await generateText({
    model: modelId,
    system: promptConfig.system,
    prompt: promptConfig.prompt,
    output: Output.object({ schema: workspaceTextAssistOutputSchema }),
  });

  const suggestions = normalizeSuggestions(output.suggestions, promptConfig.maxSuggestions);

  if (suggestions.length === 0) {
    throw new Error('Workspace AI assist returned no suggestions');
  }

  return {
    kind: input.kind,
    suggestions,
    modelId,
  };
}

export function resolveWorkspaceImageAssistCost(input: WorkspaceImageAssistRequestInput): number {
  const modelId = ensureImageModelExists(input.modelId);
  const config = IMAGE_MODEL_CONFIGS.find((entry) => entry.id === modelId);
  if (!config) return 0;
  return resolveImageCredits(config, { resolution: '1K', quality: 'medium' });
}

export async function runWorkspaceImageAssist(
  input: WorkspaceImageAssistRequestInput,
  userId: string,
): Promise<WorkspaceImageAssistResult> {
  const typedInput = input as WorkspaceImageAssistRequest;
  const modelId = ensureImageModelExists(input.modelId);
  const prompt = buildWorkspaceImageAssistPrompt(typedInput);
  const { taskId, generationId } = await triggerImageGeneration(
    {
      prompt,
      promptTitle: typedInput.context.name ?? 'Agent cover',
      modelId,
      aspectRatio: input.aspectRatio,
      resolution: '1K',
      outputFormat: 'jpg',
    },
    userId,
  );

  return {
    kind: input.kind,
    modelId,
    prompt,
    taskId,
    generationId,
  };
}
