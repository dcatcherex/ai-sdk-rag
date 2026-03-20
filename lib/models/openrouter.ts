import { ModelDefinition } from "@/types/execution";

/**
 * OpenRouter models.
 * Capabilities: text, image
 *
 * Default prompt limit: 1500 chars (conservative for OpenRouter unknown models).
 */
export const OPENROUTER_MODELS: ModelDefinition[] = [

    // --- Text ---
    {
        id: "google/gemini-2.5-flash-lite",
        name: "Google: Gemini 2.5 Flash Lite(OR)",
        description: "Gemini 2.5 Flash-Lite is a lightweight reasoning model in the Gemini 2.5 family, optimized for ultra-low latency and cost efficiency. ",
        capabilities: ["text"],
        provider: 'openrouter',
        isPaid: true,
        maxPromptLength: 1500,
        maxPromptTokens: 375,
        warningThreshold: 0.8
    },
    {
        id: "openai/gpt-oss-120b",
        name: "OpenAI: gpt-oss-120b(OR)",
        description: "gpt-oss-120b is an open-weight, 117B-parameter Mixture-of-Experts (MoE) language model from OpenAI",
        capabilities: ["text"],
        provider: 'openrouter',
        isNew: true,
        maxPromptLength: 1500,
        maxPromptTokens: 375,
        warningThreshold: 0.8
    },

    // --- Image ---
    {
        id: "google/gemini-2.5-flash-image",
        name: "Gemini 2.5 Image (OR)",
        description: "Fast image generation via OpenRouter.",
        capabilities: ["image"],
        provider: 'openrouter',
        isPaid: true,
        isNew: true,
        maxPromptLength: 1500,
        maxPromptTokens: 375,
        warningThreshold: 0.8
    },
    {
        id: "openai/gpt-5-image-mini",
        name: "OpenAI: GPT-5 Image Mini (OR)",
        description: "Fast image generation via OpenRouter.",
        capabilities: ["image"],
        provider: 'openrouter',
        isNew: true,
        maxPromptLength: 1500,
        maxPromptTokens: 375,
        warningThreshold: 0.8
    },
    {
        id: "black-forest-labs/flux.2-max",
        name: "Flux.2 Max (OR)",
        description: "State-of-the-art image generation via OpenRouter.",
        capabilities: ["image"],
        provider: 'openrouter',
        isNew: true,
        maxPromptLength: 2000,  // Flux models may support longer prompts
        maxPromptTokens: 500,
        warningThreshold: 0.8
    },
    {
        id: "black-forest-labs/flux.2-pro",
        name: "Flux.2 Pro (OR)",
        description: "State-of-the-art image generation via OpenRouter.",
        capabilities: ["image"],
        provider: 'openrouter',
        isPaid: true,
        isNew: true,
        maxPromptLength: 2000,
        maxPromptTokens: 500,
        warningThreshold: 0.8
    },
    {
        id: "black-forest-labs/flux.2-flex",
        name: "Flux.2 Flex (OR)",
        description: "Efficient image generation via OpenRouter.",
        capabilities: ["image"],
        provider: 'openrouter',
        isNew: true,
        maxPromptLength: 2000,
        maxPromptTokens: 500,
        warningThreshold: 0.8
    },
];
