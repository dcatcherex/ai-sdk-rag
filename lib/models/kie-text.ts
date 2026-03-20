import { ModelDefinition } from "@/types/execution";

/**
 * KIE.ai text generation models.
 * Capability: text
 */
export const KIE_TEXT_MODELS: ModelDefinition[] = [
    {
        id: "gemini-3-flash",
        name: "Gemini 3 Flash (KIE)",
        description: "Fast multimodal chat model with streaming and reasoning support.",
        capabilities: ["text"],
        provider: 'kie',
        costPerGeneration: 4,
        isNew: true,
        maxPromptLength: 100000,
        maxPromptTokens: 25000,
        warningThreshold: 0.8,
        guestAccess: true,
    },
    {
        id: "gemini-3-pro",
        name: "Gemini 3 Pro (KIE)",
        description: "Advanced multimodal chat model with Google Search and structured outputs.",
        capabilities: ["text"],
        provider: 'kie',
        costPerGeneration: 18,
        isNew: true,
        maxPromptLength: 120000,
        maxPromptTokens: 30000,
        warningThreshold: 0.8,
    },
];
