import { ModelDefinition } from "@/types/execution";

/**
 * Google-provider models (direct, not via Vercel Gateway).
 * Capability: image
 */
export const GOOGLE_MODELS: ModelDefinition[] = [
    {
        id: "google/gemini-2.5-flash-image-vertex",
        name: "Gemini 2.5 Flash Image (Vertex)",
        description: "Standard image generation via Google Vertex AI.",
        provider: 'google',
        capabilities: ["image"],
        maxPromptLength: 100000,
        maxPromptTokens: 25000,
        warningThreshold: 0.8
    },
    {
        id: "gemini-3-pro-image-preview",
        name: "Gemini 3.0 Pro Image",
        description: "High-fidelity image generation (Up to 4K). Supports up to 14 reference images.",
        provider: 'google',
        capabilities: ["image"],
        isPaid: true,
        maxPromptLength: 120000,
        maxPromptTokens: 30000,
        warningThreshold: 0.8
    },
    {
        id: "gemini-2.5-flash-preview-tts",
        name: "Gemini 2.5 Flash Text-to-Speech",
        description: "High-fidelity text-to-speech generation with low-latency and cost-efficient audio generation.",
        provider: 'google',
        capabilities: ["speech"],
        isPaid: true,
        maxPromptLength: 8192,
        maxPromptTokens: 8192,
        warningThreshold: 0.8
    },
];
