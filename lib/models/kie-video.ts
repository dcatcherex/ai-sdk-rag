import { ModelDefinition } from "@/types/execution";

/**
 * KIE.ai video generation models.
 * Capability: video
 *
 * Note: Veo tasks use a different status endpoint than image tasks.
 * See: /api/v1/veo/record-info?taskId=xxx
 */
export const KIE_VIDEO_MODELS: ModelDefinition[] = [

    // --- Veo ---
    {
        id: "veo3_fast",
        name: "Veo 3.1 Fast",
        description: "Advanced video generation.",
        capabilities: ["video"],
        provider: 'kie',
        costPerGeneration: 60,
        isNew: true,
        maxPromptLength: 3000,
        maxPromptTokens: 750,
        warningThreshold: 0.8
    },
    {
        id: "veo3",
        name: "Veo 3.1 Quality",
        description: "Advanced video generation.",
        capabilities: ["video"],
        provider: 'kie',
        costPerGeneration: 60,
        isNew: true,
        maxPromptLength: 3000,
        maxPromptTokens: 750,
        warningThreshold: 0.8
    },

    // --- Kling ---
    {
        id: "kling-2.6/image-to-video",
        name: "Kling 2.6 (Img2Vid)",
        description: "Animate images with Kling 2.6.",
        capabilities: ["video"],
        provider: 'kie',
        costPerGeneration: 55,
        isNew: true,
        maxPromptLength: 2000,
        maxPromptTokens: 500,
        warningThreshold: 0.8
    },

    // --- Sora 2 Pro ---
    {
        id: "sora-2-pro-text-to-video",
        name: "Sora 2 Pro",
        description: "Top-tier text-to-video.",
        capabilities: ["video"],
        provider: 'kie',
        costPerGeneration: 150,
        isNew: true,
        maxPromptLength: 4000,
        maxPromptTokens: 1000,
        warningThreshold: 0.8
    },
    {
        id: "sora-2-pro-image-to-video",
        name: "Sora 2 Pro (Img2Vid)",
        description: "Top-tier image-to-video.",
        capabilities: ["video"],
        provider: 'kie',
        costPerGeneration: 150,
        isNew: true,
        maxPromptLength: 4000,
        maxPromptTokens: 1000,
        warningThreshold: 0.8
    },
    {
        id: "sora-2-pro-storyboard",
        name: "Sora 2 Pro Storyboard",
        description: "Generate video storyboards.",
        capabilities: ["video"],
        provider: 'kie',
        costPerGeneration: 150,
        isNew: true,
        maxPromptLength: 5000,  // Storyboards may need detailed descriptions
        maxPromptTokens: 1250,
        warningThreshold: 0.8
    },

    // --- Sora 2 Standard ---
    {
        id: "sora-2-text-to-video",
        name: "Sora 2",
        description: "Standard text-to-video.",
        capabilities: ["video"],
        provider: 'kie',
        costPerGeneration: 30,
        isNew: true,
        maxPromptLength: 3000,
        maxPromptTokens: 750,
        warningThreshold: 0.8
    },
    {
        id: "sora-2-image-to-video",
        name: "Sora 2 (Img2Vid)",
        description: "Standard image-to-video.",
        capabilities: ["video"],
        provider: 'kie',
        costPerGeneration: 30,
        isNew: true,
        maxPromptLength: 3000,
        maxPromptTokens: 750,
        warningThreshold: 0.8
    },

    // --- Utilities ---
    {
        id: "sora-watermark-remover",
        name: "Sora Watermark Remover",
        description: "Utility to clean video outputs.",
        capabilities: ["video"],
        provider: 'kie',
        costPerGeneration: 10,
        isNew: true,
        maxPromptLength: 1000,
        maxPromptTokens: 250,
        warningThreshold: 0.8
    },
];
