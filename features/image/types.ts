export type ImageProvider = 'kie' | 'openai' | 'qwen' | 'xai';

/** Minimal shape needed by the shared ModelSelector component */
export interface BaseModelConfig {
  id: string;
  name: string;
  description?: string;
  badge?: string;
  provider: string;
}

export interface ImageModelConfig extends BaseModelConfig {
  provider: ImageProvider;
  /** 'both' = text-only AND with reference images */
  mode: 'generate' | 'edit' | 'both';
  aspectRatios: string[];
  hasQuality?: boolean;    // GPT Image 1.5
  hasResolution?: boolean; // Nano Banana 2
  hasGoogleSearch?: boolean; // Nano Banana 2
  hasSeed?: boolean;       // Qwen models
  requiresImages?: boolean;
  creditCost: number;
}

export const IMAGE_MODEL_CONFIGS: ImageModelConfig[] = [
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    description: 'Versatile with many aspect ratios, up to 4K resolution, and optional reference images',
    badge: 'Popular',
    provider: 'kie',
    mode: 'both',
    aspectRatios: ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '21:9', '4:5', '5:4'],
    hasResolution: true,
    hasGoogleSearch: true,
    creditCost: 8,
  },
  {
    id: 'gpt-image/1.5-text-to-image',
    name: 'GPT Image 1.5',
    description: 'Photorealistic generation with quality control',
    badge: 'Photorealistic',
    provider: 'openai',
    mode: 'generate',
    aspectRatios: ['1:1', '2:3', '3:2'],
    hasQuality: true,
    creditCost: 4,
  },
  {
    id: 'gpt-image/1.5-image-to-image',
    name: 'GPT Image 1.5 Edit',
    description: 'Identity-preserving image edits with quality control',
    badge: 'Precise Edit',
    provider: 'openai',
    mode: 'edit',
    aspectRatios: ['1:1', '2:3', '3:2'],
    hasQuality: true,
    requiresImages: true,
    creditCost: 4,
  },
  {
    id: 'z-image',
    name: 'Qwen Z-Image',
    description: 'Fast and affordable, excellent bilingual text rendering',
    badge: 'Fast',
    provider: 'qwen',
    mode: 'generate',
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    hasSeed: true,
    creditCost: 1,
  },
  {
    id: 'qwen/image-edit',
    name: 'Qwen Image Edit',
    description: 'Open-source image editing with seed for reproducibility',
    badge: 'Edit',
    provider: 'qwen',
    mode: 'edit',
    aspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'],
    hasSeed: true,
    requiresImages: true,
    creditCost: 2,
  },
  {
    id: 'grok-imagine/text-to-image',
    name: 'Grok Imagine',
    description: "xAI's creative and expressive image generation",
    badge: 'New',
    provider: 'xai',
    mode: 'generate',
    aspectRatios: ['1:1', '2:3', '3:2'],
    creditCost: 4,
  },
];

/** Maps aspect ratio string → [width, height] for visual preview boxes */
export const ASPECT_RATIO_DIMS: Record<string, [number, number]> = {
  'auto':  [28, 22],
  '1:1':   [24, 24],
  '16:9':  [32, 18],
  '9:16':  [18, 32],
  '4:3':   [28, 21],
  '3:4':   [21, 28],
  '2:3':   [20, 30],
  '3:2':   [30, 20],
  '21:9':  [34, 14],
  '4:5':   [22, 28],
  '5:4':   [28, 22],
  '1:4':   [14, 32],
  '4:1':   [32, 14],
};

export interface ImageGenerationState {
  status: 'idle' | 'polling' | 'success' | 'failed' | 'timeout';
  output?: string;
  error?: string;
  generationId?: string;
}
