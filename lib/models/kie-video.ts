import type { ModelDefinition } from "@/types/execution";

/**
 * KIE.ai video generation models.
 *
 * Each model has a `videoOptions` block that is the single source of truth for:
 *  - which API endpoint/format to use (`apiType`)
 *  - what input the model accepts (`inputMode`)
 *  - which controls to render in the UI (aspectRatios, duration, quality)
 *  - display metadata (iconProvider, badge)
 *
 * service.ts reads `videoOptions` to build the correct API payload.
 * The UI reads `videoOptions` to render only the relevant controls.
 * Adding a new model = add one entry here. No other files need to change.
 *
 * Endpoint notes:
 *  - Veo:      POST /api/v1/veo/generate  (flat payload, special status endpoint)
 *  - Standard: POST /api/v1/jobs/createTask  (nested `input` object)
 */
export const KIE_VIDEO_MODELS: ModelDefinition[] = [

  // ─── Veo 3.1 ────────────────────────────────────────────────────────────────
  {
    id: "veo3_fast",
    name: "Veo 3.1 Fast",
    description: "Fast text-to-video with frame control and reference modes. Includes audio.",
    capabilities: ["video"],
    provider: 'kie',
    costPerGeneration: 60,
    isNew: true,
    maxPromptLength: 3000,
    maxPromptTokens: 750,
    warningThreshold: 0.8,
    videoOptions: {
      apiType: 'veo',
      inputMode: 'both',
      aspectRatios: ['16:9', '9:16', 'Auto'],
      duration: null,          // Veo does not expose duration control
      quality: null,           // Veo does not expose quality control
      promptRequired: true,
      veoModes: ['TEXT_2_VIDEO', 'FIRST_AND_LAST_FRAMES_2_VIDEO', 'REFERENCE_2_VIDEO'],
      iconProvider: 'google',
      badge: 'Default',
    },
  },
  {
    id: "veo3",
    name: "Veo 3.1 Quality",
    description: "Higher quality Veo output. Text-to-video only. Includes audio.",
    capabilities: ["video"],
    provider: 'kie',
    costPerGeneration: 60,
    isNew: true,
    maxPromptLength: 3000,
    maxPromptTokens: 750,
    warningThreshold: 0.8,
    videoOptions: {
      apiType: 'veo',
      inputMode: 'text',
      aspectRatios: ['16:9', '9:16', 'Auto'],
      duration: null,
      quality: null,
      promptRequired: true,
      veoModes: ['TEXT_2_VIDEO'],  // Quality mode: text-to-video only
      iconProvider: 'google',
      badge: 'Quality',
    },
  },

  // ─── Kling 3.0 ──────────────────────────────────────────────────────────────
  {
    id: "kling-3.0/video",
    name: "Kling 3.0",
    description: "Image-to-video with native audio and multi-shot storytelling.",
    capabilities: ["video"],
    provider: 'kie',
    costPerGeneration: 55,
    isNew: true,
    maxPromptLength: 2000,
    maxPromptTokens: 500,
    warningThreshold: 0.8,
    videoOptions: {
      apiType: 'standard',
      inputMode: 'image',
      aspectRatios: null,      // Kling derives aspect from the input image
      duration: null,          // No duration control exposed
      quality: { param: 'mode', values: ['std', 'pro'] },
      promptRequired: true,
      iconProvider: 'kie',
      badge: 'New',
    },
  },

  // ─── Sora 2 Pro ─────────────────────────────────────────────────────────────
  {
    id: "sora-2-pro-text-to-video",
    name: "Sora 2 Pro",
    description: "Top-tier text-to-video with quality control. Up to 15 seconds.",
    capabilities: ["video"],
    provider: 'kie',
    costPerGeneration: 150,
    isNew: true,
    maxPromptLength: 10000,
    maxPromptTokens: 2500,
    warningThreshold: 0.8,
    videoOptions: {
      apiType: 'standard',
      inputMode: 'text',
      aspectRatios: ['landscape', 'portrait'],
      duration: ['10', '15'],
      quality: { param: 'size', values: ['standard', 'high'] },
      promptRequired: true,
      iconProvider: 'openai',
      badge: 'Pro',
    },
  },
  {
    id: "sora-2-pro-image-to-video",
    name: "Sora 2 Pro (Img→Vid)",
    description: "Top-tier image animation with quality control. Up to 15 seconds.",
    capabilities: ["video"],
    provider: 'kie',
    costPerGeneration: 150,
    isNew: true,
    maxPromptLength: 10000,
    maxPromptTokens: 2500,
    warningThreshold: 0.8,
    videoOptions: {
      apiType: 'standard',
      inputMode: 'image',
      aspectRatios: ['landscape', 'portrait'],
      duration: ['10', '15'],
      quality: { param: 'size', values: ['standard', 'high'] },
      promptRequired: true,
      iconProvider: 'openai',
      badge: 'Pro',
    },
  },
  {
    id: "sora-2-pro-storyboard",
    name: "Sora 2 Pro Storyboard",
    description: "Panel-to-video from storyboard images. No prompt needed. Up to 25 seconds.",
    capabilities: ["video"],
    provider: 'kie',
    costPerGeneration: 150,
    isNew: true,
    maxPromptLength: 0,
    maxPromptTokens: 0,
    warningThreshold: 0.8,
    videoOptions: {
      apiType: 'standard',
      inputMode: 'storyboard',  // images are storyboard panels; prompt is not used
      aspectRatios: ['landscape', 'portrait'],
      duration: ['10', '15', '25'],
      quality: null,
      promptRequired: false,
      iconProvider: 'openai',
      badge: 'Pro',
    },
  },

  // ─── Sora 2 Standard ────────────────────────────────────────────────────────
  {
    id: "sora-2-text-to-video",
    name: "Sora 2",
    description: "Affordable text-to-video. Up to 15 seconds.",
    capabilities: ["video"],
    provider: 'kie',
    costPerGeneration: 30,
    isNew: true,
    maxPromptLength: 10000,
    maxPromptTokens: 2500,
    warningThreshold: 0.8,
    videoOptions: {
      apiType: 'standard',
      inputMode: 'text',
      aspectRatios: ['landscape', 'portrait'],
      duration: ['10', '15'],
      quality: null,
      promptRequired: true,
      iconProvider: 'openai',
    },
  },
  {
    id: "sora-2-image-to-video",
    name: "Sora 2 (Img→Vid)",
    description: "Affordable image animation. Up to 15 seconds.",
    capabilities: ["video"],
    provider: 'kie',
    costPerGeneration: 30,
    isNew: true,
    maxPromptLength: 10000,
    maxPromptTokens: 2500,
    warningThreshold: 0.8,
    videoOptions: {
      apiType: 'standard',
      inputMode: 'image',
      aspectRatios: ['landscape', 'portrait'],
      duration: ['10', '15'],
      quality: null,
      promptRequired: true,
      iconProvider: 'openai',
    },
  },
];
