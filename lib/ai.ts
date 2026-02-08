export type ModelOption = {
  id: string;
  name: string;
  provider: Provider;
  description: string;
  capabilities?: Capability[];
};

export type Capability = 'text' | 'implicit caching' | 'explicit caching' | 'web search' | 'image gen';
export type Provider = 'google' | 'openai' | 'anthropic';

export const availableModels = [
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    capabilities: ['text','implicit caching','web search'],
    provider: 'google',
    description: 'Fast and efficient model',
  },
  {
    id: 'google/gemini-3-flash',
    name: 'Gemini 3 Flash',
    capabilities: ['text','implicit caching','web search'],
    provider: 'google',
    description: 'Fast and efficient model',
  },
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    capabilities: ['text','implicit caching','web search'],
    provider: 'google',
    description: 'Fast and efficient model',
  },
  {
    id: 'google/gemini-2.5-flash-image',
    name: 'Gemini 2.5 Flash Image',
    capabilities: ['text','web search','image gen'],
    provider: 'google',
    description: 'Fast and efficient model',
  },
  {
    id: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    capabilities: ['text','implicit caching'],
    provider: 'openai',
    description: 'The best model for coding and agentic tasks across industries',
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    capabilities: ['text','implicit caching'],
    provider: 'openai',
    description: 'A faster, cost-efficient version of GPT-5 for well-defined tasks',
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    capabilities: ['text','implicit caching'],
    provider: 'openai',
    description: 'Fastest, most cost-efficient version of GPT-5',
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    capabilities: ['text','explicit caching'],
    provider: 'anthropic',
    description: 'Balanced performance and speed',
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    capabilities: ['text','explicit caching'],
    provider: 'anthropic',
    description: 'Balanced performance and speed',
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    capabilities: ['text','explicit caching','web search'],
    provider: 'anthropic',
    description: 'Balanced performance and speed',
  },
] satisfies ModelOption[];

export const chatModel = availableModels[0]?.id ?? 'google/gemini-3-flash';
export const maxSteps = 5;
