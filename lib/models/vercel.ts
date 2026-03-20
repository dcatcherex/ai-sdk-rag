import { ModelDefinition } from "@/types/execution";

/**
 * Vercel AI Gateway models.
 * Capabilities: text, image
 */
export const VERCEL_MODELS: ModelDefinition[] = [

    // --- Text ---
    {
        id: "google/gemini-3-flash",
        name: "Gemini 3 Flash",
        description: "Latest Gemini 3 Flash via Vercel AI Gateway.",
        capabilities: ["text"],
        provider: 'vercel',
        isNew: true,
        costPerGeneration: 4,
        maxPromptLength: 100000,
        maxPromptTokens: 25000,
        warningThreshold: 0.8,
        guestAccess: true,
    },
    {
        id: "google/gemini-3-pro-preview",
        name: "Gemini 3 Pro",
        description: "Advanced Gemini 3 Pro via Vercel AI Gateway.",
        capabilities: ["text"],
        provider: 'vercel',
        isNew: true,
        costPerGeneration: 18,
        maxPromptLength: 120000,
        maxPromptTokens: 30000,
        warningThreshold: 0.8,
    },
    {
        id: "google/gemini-2.5-flash-lite-vercel",
        name: "Gemini 2.5 Flash Lite (Vercel)",
        description: "Low-latency, lightweight Gemini model via Vercel.",
        capabilities: ["text"],
        provider: 'vercel',
        isNew: true,
        maxPromptLength: 50000,
        maxPromptTokens: 12500,
        warningThreshold: 0.8
    },
    {
        id: "google/gemini-2.5-flash",
        name: "Gemini 2.5 Flash (Vercel)",
        description: "Standard Flash model via Vercel Gateway.",
        capabilities: ["text"],
        provider: 'vercel',
        maxPromptLength: 50000,
        maxPromptTokens: 12500,
        warningThreshold: 0.8,
        guestAccess: true
    },
    {
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        description: "Fastest Claude model for pure speed.",
        capabilities: ["text"],
        provider: 'vercel',
        isNew: true,
        maxPromptLength: 80000,
        maxPromptTokens: 20000,
        warningThreshold: 0.8
    },
    {
        id: "anthropic/claude-3.7-sonnet",
        name: "Claude 3.7 Sonnet",
        description: "Balanced intelligence and speed.",
        capabilities: ["text"],
        provider: 'vercel',
        isNew: true,
        maxPromptLength: 100000,
        maxPromptTokens: 25000,
        warningThreshold: 0.8
    },
    {
        id: "openai/gpt-5-mini",
        name: "GPT-5 Mini",
        description: "Efficient reasoning model.",
        capabilities: ["text"],
        provider: 'vercel',
        isNew: true,
        maxPromptLength: 50000,
        maxPromptTokens: 12500,
        warningThreshold: 0.8
    },
    {
        id: "openai/gpt-5-nano",
        name: "GPT-5 Nano",
        description: "Smallest, fastest GPT-5 variant.",
        capabilities: ["text"],
        provider: 'vercel',
        isNew: true,
        maxPromptLength: 40000,
        maxPromptTokens: 10000,
        warningThreshold: 0.8
    },
    {
        id: "xai/grok-4.1-fast-non-reasoning",
        name: "Grok 4.1 Fast",
        description: "High-speed non-reasoning model.",
        capabilities: ["text"],
        provider: 'vercel',
        isNew: true,
        maxPromptLength: 50000,
        maxPromptTokens: 12500,
        warningThreshold: 0.8
    },
    {
        id: "xai/grok-4.1-fast-reasoning",
        name: "Grok 4.1 Reasoning",
        description: "Fast model with reasoning capabilities.",
        capabilities: ["text"],
        provider: 'vercel',
        isNew: true,
        maxPromptLength: 50000,
        maxPromptTokens: 12500,
        warningThreshold: 0.8
    },

    // --- Image ---
    {
        id: "google/gemini-2.5-flash-image-preview",
        name: "Gemini 2.5 Flash Image",
        description: "Fast image generation via Vercel.",
        capabilities: ["image"],
        provider: 'vercel',
        isNew: true,
        maxPromptLength: 50000,
        maxPromptTokens: 12500,
        warningThreshold: 0.8,
        guestAccess: true
    },
    {
        id: "google/gemini-3-pro-preview",
        name: "Gemini 3 Pro Image",
        description: "Pro-tier image generation via Vercel.",
        capabilities: ["image"],
        provider: 'vercel',
        isNew: true,
        maxPromptLength: 60000,
        maxPromptTokens: 15000,
        warningThreshold: 0.8
    },
];
