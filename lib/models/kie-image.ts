import { ModelDefinition } from "@/types/execution";

/**
 * KIE.ai image generation models.
 * Capability: image
 *
 * Prompt Length Limits:
 * - Most KIE image models: 1000–6000 chars (conservative, provider-tested)
 * - TODO markers indicate limits needing verification from KIE docs or testing
 */
export const KIE_IMAGE_MODELS: ModelDefinition[] = [

    // --- Gemini / Nano Banana ---
    {
        id: "google/nano-banana",
        name: "Nano Banana",
        description: "Gemini 2.5 Flash for unbeatable speed and cost-efficiency",
        capabilities: ["image"],
        provider: 'kie',
        costPerGeneration: 4,
        isNew: false,
        maxPromptLength: 5000,
        maxPromptTokens: 1250,
        warningThreshold: 0.8,
        guestAccess: true,
        maxReferenceImages: 0
    },
    {
        id: "nano-banana-2",
        name: "Nano Banana 2",
        description: "Nano Banana 2 for unbeatable speed and cost-efficiency",
        capabilities: ["image"],
        aspectRatio: ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9", "auto"],
        provider: 'kie',
        costPerGeneration: 8,
        isNew: true,
        maxPromptLength: 5000,
        maxPromptTokens: 1250,
        warningThreshold: 0.8,
        guestAccess: true,
        maxReferenceImages: 0
    },

    {
        id: "google/nano-banana-edit",
        name: "Nano Banana Edit",
        description: "Edit existing images with Nano Banana.",
        capabilities: ["image"],
        provider: 'kie',
        costPerGeneration: 4,
        isNew: true,
        maxPromptLength: 5000,
        maxPromptTokens: 1250,
        warningThreshold: 0.8,
        maxReferenceImages: 10,
        referenceImageParam: 'image_urls',
        requiresReferenceImages: true
    },
    {
        id: "nano-banana-pro",
        name: "Nano Banana Pro",
        description: "Gemini 3 Pro Image for flawless text rendering, 4K resolution, and complex semantic reasoning.",
        capabilities: ["image"],
        provider: 'kie',
        costPerGeneration: 18,
        isNew: true,
        maxPromptLength: 6000,
        maxPromptTokens: 1500,
        warningThreshold: 0.8,
        maxReferenceImages: 8,
        referenceImageParam: 'image_input'
    },

    // --- GPT Image ---
    {
        id: "gpt-image/1.5-text-to-image",
        name: "GPT Image 1.5",
        description: "GPT Image 1.5 for text-to-image generation.",
        capabilities: ["image"],
        aspectRatio: ["1:1", "2:3", "3:2"],
        provider: 'kie',
        costPerGeneration: 4,
        isNew: true,
        maxPromptLength: 3000,
        maxPromptTokens: 1500,
        warningThreshold: 0.8,
        maxReferenceImages: 0
    },
    {
        id: "gpt-image/1.5-image-to-image",
        name: "GPT Image 1.5 (Image Edit)",
        description: "GPT Image 1.5 image-to-image transformation with quality control.",
        capabilities: ["image"],
        aspectRatio: ["1:1", "2:3", "3:2"],
        provider: 'kie',
        costPerGeneration: 4,
        isNew: true,
        maxPromptLength: 3000,
        maxPromptTokens: 1500,
        warningThreshold: 0.8,
        maxReferenceImages: 10,
        referenceImageParam: 'input_urls',
        requiresReferenceImages: true
    },

    // --- seedream Image --- 
    {
        id: "seedream/5-lite-text-to-image",
        name: "Seedream 5 Lite",
        description: "Seedream 5 Lite is Bytedance's refined image model for 4K generation, precise editing, and consistent multi-image output.",
        capabilities: ["image"],
        aspectRatio: ["1:1", "4:3", "3:2", "3:4", "16:9", "9:16", "2:3", "21:9"],   
        provider: 'kie',
        costPerGeneration: 4,
        isNew: true,
        maxPromptLength: 3000,
        maxPromptTokens: 1500,
        warningThreshold: 0.8,
        maxReferenceImages: 10,
        referenceImageParam: 'input_urls',
        requiresReferenceImages: true
    },
    {
        id: "seedream/5-lite-image-to-image",
        name: "Seedream 5 Lite",
        description: "Seedream 5 Lite is Bytedance's refined image model for 4K generation, precise editing, and consistent multi-image output.",
        capabilities: ["image"],
        aspectRatio: ["1:1", "4:3", "3:2", "3:4", "16:9", "9:16", "2:3", "21:9"],  
        provider: 'kie',
        costPerGeneration: 4,
        isNew: true,
        maxPromptLength: 3000,
        maxPromptTokens: 1500,
        warningThreshold: 0.8,
        maxReferenceImages: 10,
        referenceImageParam: 'input_urls',
        requiresReferenceImages: true
    },

    // --- Midjourney ---
    {
        id: "features/mj-api",
        name: "Midjourney Text to Image",
        description: "Create a new image generation task using the Midjourney AI model",
        capabilities: ["image"],
        provider: 'kie',
        costPerGeneration: 8,
        isNew: true,
        maxPromptLength: 2000,  // TODO: Verify from Kie.ai docs - conservative estimate
        maxPromptTokens: 500,
        warningThreshold: 0.8,
        maxReferenceImages: 0
    },

    // --- 4o Image ---
    {
        id: "4o-image-api",
        name: "4o Image API",
        description: "Optimized image generation API.",
        capabilities: ["image"],
        provider: 'kie',
        costPerGeneration: 4,
        isNew: true,
        maxPromptLength: 4000,
        maxPromptTokens: 1000,
        warningThreshold: 0.8,
        maxReferenceImages: 0
    },

    // --- Seedream ---
    {
        id: "seedream/4.5-text-to-image",
        name: "Seedream 4.5",
        description: "Seedream 4.5 is Bytedance's refined image model for 4K generation, precise editing, and consistent multi-image output.",
        capabilities: ["image"],
        provider: 'kie',
        costPerGeneration: 6.5,
        isNew: true,
        maxPromptLength: 1600,  // TODO: Verify - conservative default
        maxPromptTokens: 400,
        warningThreshold: 0.8,
        maxReferenceImages: 0
    },
    {
        id: "seedream/4.5-edit",
        name: "Seedream 4.5 Edit",
        description: "Seedream 4.5 is Bytedance's refined image model for 4K generation, precise editing, and consistent multi-image output.",
        capabilities: ["image"],
        provider: 'kie',
        costPerGeneration: 6.5,
        isNew: true,
        maxPromptLength: 1600,
        maxPromptTokens: 400,
        warningThreshold: 0.8,
        maxReferenceImages: 0
    },

    // --- Qwen / Z-Image ---
    {
        id: "qwen2/text-to-image",
        name: "Qwen2 Text To Image",
        description: "Qwen2-Text-To-Image is an open-source text-to-image generation model based on Qwen2-Image",
        capabilities: ["image"],
        provider: 'kie',
        costPerGeneration: 3,
        isNew: true,
        maxPromptLength: 5000,
        maxPromptTokens: 1500,
        warningThreshold: 0.8,
        guestAccess: true,
        maxReferenceImages: 0
    },
    {
        id: "qwen2/image-edit",
        name: "Qwen2 Image Edit",
        description: "Qwen2-Image-Edit is an open-source image editing model based on Qwen2-Image",
        capabilities: ["image"],
        provider: 'kie',
        costPerGeneration: 3,
        isNew: true,
        maxPromptLength: 800,
        maxPromptTokens: 250,
        warningThreshold: 0.8,
        maxReferenceImages: 0 // TODO: Verify from Kie.ai docs
    },

    // --- Grok Imagine ---
    {
        id: "grok-imagine/text-to-image",
        name: "Grok Imagine",
        description: "Grok Imagine is xAI's multimodal image and video generation model that converts text or images into short visual outputs with coherent motion and synchronized audio.",
        capabilities: ["image"],
        aspectRatio: ["2:3", "3:2", "1:1"],
        provider: 'kie',
        costPerGeneration: 4,
        isNew: true,
        maxPromptLength: 5000,
        maxPromptTokens: 1250,
        warningThreshold: 0.8,
        maxReferenceImages: 0
    },
];
