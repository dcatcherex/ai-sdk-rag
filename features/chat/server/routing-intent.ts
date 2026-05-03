export type RoutingIntent = {
  wantsImage: boolean;
  wantsWeb: boolean;
  wantsCode: boolean;
  wantsReasoning: boolean;
  wordCount: number;
};

export function detectRoutingIntent(input: {
  prompt: string | null;
  useWebSearch?: boolean;
}): RoutingIntent {
  const { prompt, useWebSearch } = input;

  if (!prompt) {
    return {
      wantsImage: false,
      wantsWeb: false,
      wantsCode: false,
      wantsReasoning: false,
      wordCount: 0,
    };
  }

  const trimmedPrompt = prompt.trim();
  const lower = trimmedPrompt.toLowerCase();
  const wordCount = trimmedPrompt ? trimmedPrompt.split(/\s+/).length : 0;

  const wantsImage =
    lower.startsWith('create image') ||
    lower.startsWith('generate image') ||
    lower.startsWith('edit image') ||
    lower.includes('image of') ||
    lower.includes('edit this image') ||
    lower.includes('change this image') ||
    lower.includes('remove background') ||
    lower.includes('draw ') ||
    lower.includes('illustration');

  const wantsWeb =
    Boolean(useWebSearch) ||
    lower.includes('search') ||
    lower.includes('latest') ||
    lower.includes('news') ||
    lower.includes('web');

  const wantsCode =
    lower.includes('code') ||
    lower.includes('coding') ||
    lower.includes('typescript') ||
    lower.includes('javascript') ||
    lower.includes('python') ||
    lower.includes('refactor') ||
    lower.includes('debug') ||
    lower.includes('implement') ||
    lower.includes('class');

  const wantsReasoning =
    lower.includes('analy') ||
    lower.includes('reason') ||
    lower.includes('compare') ||
    lower.includes('evaluate') ||
    lower.includes('diagnose') ||
    lower.includes('pros and cons') ||
    lower.includes('tradeoff');

  return {
    wantsImage,
    wantsWeb,
    wantsCode,
    wantsReasoning,
    wordCount,
  };
}
