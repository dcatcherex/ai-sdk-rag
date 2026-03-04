export type ModelOption = {
  id: string;
  name: string;
  context?: string;
  latency?: number; // seconds
  throughput?: number; // token per second
  inputCost?: number; // dollar per 1m tokens
  outputCost?: number; // dollar per 1m tokens
  imageGenCost?: { [key: string]: number }[]; // array of objects with key as image size and value as cost
  provider: Provider;
  description: string;
  capabilities?: Capability[];
};

export type Capability =
  | "text"
  | "implicit caching"
  | "explicit caching"
  | "web search"
  | "image gen"
  | "embeddings"
  | "video gen";

export type Provider =
  | "google"
  | "openai"
  | "anthropic"
  | "xai"
  | "moonshotai"
  | "deepseek"
  | "alibaba"
  | "minimax"
  | "zai";

export const availableModels = [
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    context: "1m",
    latency: 0.3,
    throughput: 246,
    inputCost: 0.1,
    outputCost: 0.4,
    capabilities: ["text", "implicit caching", "web search"],
    provider: "google",
    description: "Fast and efficient model",
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite Preview",
    context: "1m",
    latency: 4.6,
    throughput: 156,
    inputCost: 2,
    outputCost: 12,
    capabilities: ["text", "implicit caching", "web search"],
    provider: "google",
    description: "Fast and efficient model",
  },
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    context: "1m",
    latency: 3.2,
    throughput: 155,
    inputCost: 2,
    outputCost: 12,
    capabilities: ["text", "implicit caching", "web search"],
    provider: "google",
    description: "Fast and efficient model",
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    name: "Gemini 3.1 Flash Image Preview",
    context: "1m",
    latency: 12.1,
    throughput: 275,
    inputCost: 0.5,
    outputCost: 3,
    imageGenCost: [
      { "512": 0.04 },
      { "1k": 0.07 },
      { "2k": 0.1 },
      { "4k": 0.15 },
    ],
    capabilities: ["text", "web search", "image gen"],
    provider: "google",
    description: "Fast and efficient model",
  },
  {
    id: "google/gemini-3-pro-image",
    name: "Gemini 3 Pro Image",
    context: "66k",
    latency: 11.9,
    throughput: 209,
    inputCost: 2,
    outputCost: 12,
    imageGenCost: [{ "1k": 0.13 }, { "2k": 0.26 }, { "4k": 0.24 }],
    capabilities: ["text", "web search", "image gen"],
    provider: "google",
    description: "Fast and efficient model",
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    context: "400K",
    latency: 6.4,
    throughput: 145,
    inputCost: 0.05,
    outputCost: 0.4,
    capabilities: ["text", "implicit caching"],
    provider: "openai",
    description: "Fastest, most cost-efficient version of GPT-5",
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    context: "400k",
    latency: 5,
    throughput: 269,
    inputCost: 0.25,
    outputCost: 2,
    capabilities: ["text", "implicit caching"],
    provider: "openai",
    description:
      "A faster, cost-efficient version of GPT-5 for well-defined tasks",
  },
  {
    id: "openai/gpt-5.3-chat",
    name: "GPT-5.3 Chat",
    context: "128k",
    latency: 0.6,
    throughput: 82,
    inputCost: 1.75,
    outputCost: 14,
    capabilities: ["text", "implicit caching", "web search"],
    provider: "openai",
    description:
      "A faster, cost-efficient version of GPT-5 for well-defined tasks",
  },
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    context: "400k",
    latency: 1.7,
    throughput: 67,
    inputCost: 1.75,
    outputCost: 14,
    capabilities: ["text", "implicit caching"],
    provider: "openai",
    description:
      "The best model for coding and agentic tasks across industries",
  },
  {
    id: "openai/gpt-oss-safeguard-20b",
    name: "GPT OSS Safeguard 20B", 
    context: "131k",
    latency: 0.1,
    inputCost: 0.07,
    outputCost: 0.3,
    capabilities: ["text", "implicit caching"],
    provider: "openai",
    description:
      "The best model for coding and agentic tasks across industries",
  },

  {
    id: "openai/gpt-image-1.5",
    name: "GPT Image 1.5",
    imageGenCost: [
      { "1536x1024low": 0.01 },
      { "1024x1024low": 0.01 },
      { "1024x1536low": 0.01 },
      { "1536x1024high": 0.2 },
      { "1024x1024high": 0.13 },
      { "1024x1536high": 0.2 },
      { "1536x1024medium": 0.05 },
      { "1024x1024medium": 0.03 },
      { "1024x1536medium": 0.05 },
    ],
    capabilities: ["image gen"],
    provider: "openai",
    description: "Fast and efficient model",
  },

  {
    id: "xai/grok-4.1-fast-non-reasoning",
    name: "Grok 4.1 Fast Non Reasoning", 
    context: "2m",
    latency: 0.7,
    throughput: 80,
    inputCost: 0.2,
    outputCost: 0.5,
    capabilities: ["image gen"],
    provider: "xai",
    description: "Fast and efficient model",
  },
  {
    id: "xai/grok-4.1-fast-reasoning",
    name: "Grok 4.1 Fast Reasoning", 
    context: "2m",
    latency: 2.5,
    throughput: 255,
    inputCost: 0.2,
    outputCost: 0.5,
    capabilities: ["image gen"],
    provider: "xai",
    description: "Fast and efficient model",
  },
  {
    id: "xai/grok-imagine-image",
    name: "Grok Imagine Image",
    imageGenCost: [{ "not specified": 0.02 }],
    capabilities: ["image gen"],
    provider: "xai",
    description: "Fast and efficient model",
  },
  {
    id: "xai/grok-imagine-image-pro",
    name: "Grok Imagine Image Pro",
    imageGenCost: [{ "not specified": 0.07 }],
    capabilities: ["image gen"],
    provider: "xai",
    description: "Pro version of Grok Imagine Image",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    capabilities: ["text", "explicit caching"],
    provider: "anthropic",
    description: "Balanced performance and speed",
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    capabilities: ["text", "explicit caching"],
    provider: "anthropic",
    description: "Balanced performance and speed",
  },
  {
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    capabilities: ["text", "explicit caching", "web search"],
    provider: "anthropic",
    description: "Balanced performance and speed",
  },
  {
    id: "minimax/minimax-m2.5",
    name: "Minimax M2.5",
    context: "205k",
    latency: 3.1,
    throughput: 59,
    inputCost: 0.3,
    outputCost: 1.2,
    capabilities: ["text", "implicit caching"],
    provider: "minimax",
    description: "Balanced performance and speed",
  },
  {
    id: "minimax/minimax-m2.1",
    name: "Minimax M2.1",
    context: "205k",
    latency: 0.3,
    throughput: 160,
    inputCost: 0.3,
    outputCost: 1.2,
    capabilities: ["text", "implicit caching"],
    provider: "minimax",
    description: "Balanced performance and speed",
  },
  {
    id: "zai/glm-5",
    name: "GLM 5", 
    context: "203k",
    latency: 9.2,
    throughput: 42,
    inputCost: 1,
    outputCost: 3.2,
    capabilities: ["text", "implicit caching"],
    provider: "zai",
    description: "Balanced performance and speed",
  },
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5", 
    context: "262k",
    latency: 0.3,
    throughput: 79,
    inputCost: 0.5,
    outputCost: 2.8,
    capabilities: ["text", "implicit caching"],
    provider: "moonshotai",
    description: "Balanced performance and speed",
  },
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2", 
    context: "164k",
    latency: 1.3,
    throughput: 30,
    inputCost: 0.26,
    outputCost: 0.38,
    capabilities: ["text", "implicit caching"],
    provider: "deepseek",
    description: "Balanced performance and speed",
  },
  {
    id: "alibaba/qwen3.5-flash",
    name: "Qwen 3.5 Flash", 
    context: "1m",
    latency: 1.3,
    throughput: 122,
    inputCost: 0.1,
    outputCost: 0.4,
    capabilities: ["text", "explicit caching"],
    provider: "alibaba",
    description: "Balanced performance and speed",
  },
  {
    id: "alibaba/qwen3.5-plus",
    name: "Qwen 3.5 Plus", 
    context: "1m",
    latency: 2.2,
    throughput: 56,
    inputCost: 0.4,
    outputCost: 2.4,
    capabilities: ["text", "explicit caching"],
    provider: "alibaba",
    description: "Balanced performance and speed",
  },
] satisfies ModelOption[];

export const chatModel = availableModels[0]?.id ?? "google/gemini-3-flash";
export const maxSteps = 5;
