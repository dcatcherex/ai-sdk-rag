export type Gateway = "kie" | "openrouter" | "glm" | "vercel";

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
  gateway: Gateway;
  description: string;
  capabilities?: Capability[];
};

export type Capability =
  | "text"
  | "implicit caching"
  | "explicit caching"
  | "web search"
  | "image gen"
  | "vision"
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
  | "zai"
  | "xiaomi";

export const availableModels = [
  
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    context: "1m",
    latency: 0.3,
    throughput: 246,
    inputCost: 0.1,
    outputCost: 0.4,
    capabilities: ["text", "implicit caching", "web search", "vision"],
    provider: "google",
    gateway: "vercel",
    description: "Fast and efficient model",
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite Preview",
    context: "1m",
    latency: 0.8,
    throughput: 223,
    inputCost: 0.25,
    outputCost: 1.50,
    capabilities: ["text", "implicit caching", "web search", "vision"],
    provider: "google",
    gateway: "vercel",
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
    capabilities: ["text", "implicit caching", "web search", "vision"],
    provider: "google",
    gateway: "vercel",
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
    capabilities: ["text", "web search", "image gen", "vision"],
    provider: "google",
    gateway: "vercel",
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
    capabilities: ["text", "web search", "image gen", "vision"],
    provider: "google",
    gateway: "vercel",
    description: "Fast and efficient model",
  },
  {
    id: "openai/gpt-5.4-mini",
    name: "GPT 5.4 Mini",
    context: "400K",
    latency: 0.6,
    throughput: 291,
    inputCost: 0.75,
    outputCost: 4.50,
    capabilities: ["text", "implicit caching", "web search", "vision"],
    provider: "openai",
    gateway: "vercel",
    description: "Fast and efficient model",
  },
  {
    id: "openai/gpt-5.4-nano",
    name: "GPT 5.4 Nano",
    context: "400K",
    latency: 0.4,
    inputCost: 0.20,
    outputCost: 1.25,
    capabilities: ["text", "implicit caching", "web search", "vision"],
    provider: "openai",
    gateway: "vercel",
    description: "Fast and efficient model",
  },
  {
    id: "openai/gpt-5.4",
    name: "GPT-5.4",
    context: "128k",
    latency: 1.2,
    throughput: 57,
    inputCost: 2.50,
    outputCost: 15,
    capabilities: ["text", "implicit caching", "web search", "vision"],
    provider: "openai",
    gateway: "vercel",
    description: "Frontier version of GPT-5 for well-defined tasks",
  },
  {
    id: "openai/gpt-image-2",
    name: "GPT Image 2",
    inputCost: 5,
    outputCost: 30,
    capabilities: ["image gen"],
    provider: "openai",
    gateway: "vercel",
    description: "Image generation model",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    context: "200k",
    latency: 0.3,
    throughput: 116,
    inputCost: 1.00,
    outputCost: 5.00,
    capabilities: ["text", "explicit caching", "vision"],
    provider: "anthropic",
    gateway: "vercel",
    description: "Balanced performance and speed",
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    context: "1m",
    latency: 0.7,
    throughput: 59,
    inputCost: 3.00,
    outputCost: 15.00,
    capabilities: ["text", "explicit caching", "vision"],
    provider: "anthropic",
    gateway: "vercel",
    description: "Balanced performance and speed",
  },
  {
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    context: "1m",
    latency: 0.8,
    throughput: 60,
    inputCost: 5.00,
    outputCost: 25.00,
    capabilities: ["text", "explicit caching", "web search", "vision"],
    provider: "anthropic",
    gateway: "vercel",
    description: "Balanced performance and speed",
  },
  {
    id: "minimax/minimax-m2.7",
    name: "Minimax M2.7",
    context: "205k",
    latency: 2.2,
    throughput: 38,
    inputCost: 0.3,
    outputCost: 1.2,
    capabilities: ["text", "implicit caching"],
    provider: "minimax",
    gateway: "vercel",
    description: "Balanced performance and speed",
  },
  {
    id: "minimax/minimax-m2.7-highspeed",
    name: "Minimax M2.7 High Speed",
    context: "205k",
    latency: 0.8,
    throughput: 63,
    inputCost: 0.60,
    outputCost: 2.40,
    capabilities: ["text", "implicit caching"],
    provider: "minimax",
    gateway: "vercel",
    description: "Balanced performance and speed",
  },
  {
    id: "zai/glm-5-turbo",
    name: "GLM 5 Turbo", 
    context: "203k",
    latency: 4.4,
    throughput: 142,
    inputCost: 1.20,
    outputCost: 4.00,
    capabilities: ["text", "implicit caching"],
    provider: "zai",
    gateway: "vercel",
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
    gateway: "vercel",
    description: "Balanced performance and speed",
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6", 
    context: "262k",
    latency: 1,
    throughput: 70,
    inputCost: 0.95,
    outputCost: 4,
    capabilities: ["text", "implicit caching"],
    provider: "moonshotai",
    gateway: "vercel",
    description: "Balanced performance and speed",
  },
  

] satisfies ModelOption[];

export const chatModel = availableModels[1]?.id ?? "google/gemini-3.1-flash-lite-preview";
export const maxSteps = 5;
export const transcriptionModel = "google/gemini-2.5-flash-lite";

/**
 * Returns true for models capable enough to self-clarify vague prompts.
 * Prompt enhancement adds latency and a redundant LLM call for these models —
 * skip it and let the model handle ambiguity natively.
 *
 * Uses input cost ($/1M tokens) as a capability proxy: ≥ $0.50 → strong.
 * Update model costs in availableModels to keep this current; no manual list needed.
 */
export function isStrongModel(modelId: string): boolean {
  const model = availableModels.find((m) => m.id === modelId);
  return (model?.inputCost ?? 0) >= 0.5;
}
