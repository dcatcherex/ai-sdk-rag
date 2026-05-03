import { nanoid } from 'nanoid';

import type { TokenUsageSnapshot } from './schema';

export type TokenUsageInsert = {
  id: string;
  threadId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export function buildTokenUsageInsert(input: {
  threadId: string;
  model: string;
  tokenUsageData: TokenUsageSnapshot;
  createId?: () => string;
}): TokenUsageInsert {
  const { threadId, model, tokenUsageData, createId = nanoid } = input;
  const promptTokens = tokenUsageData.promptTokens || 0;
  const completionTokens = tokenUsageData.completionTokens || 0;
  const totalTokens = tokenUsageData.totalTokens || promptTokens + completionTokens;

  return {
    id: createId(),
    threadId,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
  };
}
