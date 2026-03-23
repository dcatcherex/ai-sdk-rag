import { PromptImageSettings, PromptAudioSettings, PromptTtsSettings } from '@/types/prompt';

export interface ModelExecutionConfig {
  temperature: number;
  topP: number;
  maxOutputTokens?: number;
  seed?: number;
}

export interface ExecutionResult {
  model: string;
  modelId?: string; // Optional for backward compatibility, but preferred
  output: string; // Can be text, Base64 image data URL, or Video URI
  type: 'text' | 'image' | 'video' | 'audio' | 'speech'; // Output type: text, image, video, audio, or speech
  latency: number; // ms
  cost: number; // Estimated
  timestamp: number;
  brandUsed?: string; // Track which brand context was active
  id?: string; // Optional generation ID from backend
}


export interface HistoryItem extends ExecutionResult {
  id: string;
  promptTitle: string;
  promptId: string;
  settings?: Record<string, unknown>;
}

// NEW: Queue Item for Stacking Runs
export interface QueueItem {
  id: string;
  variableValues: Record<string, string>;
  selectedModels: string[];
  imageSettings: PromptImageSettings;
  modelConfigs: Record<string, ModelExecutionConfig>;
  promptContent: string;
  selectedTools?: string[]; // Tools to use during execution
  audioSettings?: PromptAudioSettings; // Audio generation options (Suno)
  ttsSettings?: PromptTtsSettings; // Text-to-speech options (ElevenLabs)
}

/**
 * Structured capability descriptor for KIE video models.
 * Used by service.ts to build the correct API payload and
 * by the UI to render only the controls relevant to each model.
 */
export interface KieVideoOptions {
  /** Which KIE endpoint/format to use */
  apiType: 'veo' | 'standard';
  /** What input the model accepts */
  inputMode: 'text' | 'image' | 'both' | 'storyboard';
  /** Aspect ratio values shown in UI (sent as-is to API). null = not configurable */
  aspectRatios: string[] | null;
  /** Duration options — sent as n_frames strings. null = not supported by model */
  duration: string[] | null;
  /** Quality control. null = not supported */
  quality: { param: string; values: string[] } | null;
  /** Whether the text prompt field is required (false for storyboard) */
  promptRequired: boolean;
  /** Veo-only: which generation modes are available */
  veoModes?: string[];
  /** Provider slug for the icon (google, openai, kie…) */
  iconProvider: string;
  /** Badge text shown in model selector */
  badge?: string;
}

export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: ('text' | 'image' | 'video' | 'audio' | 'speech')[];
  aspectRatio?: string[];
  isPaid?: boolean; // UI hint for advanced models
  provider?: 'google' | 'kie' | 'vercel' | 'openrouter';
  costPerGeneration?: number;
  creditPerGeneration?: number;
  isNew?: boolean;

  // Prompt length limits
  maxPromptLength?: number;        // Maximum total prompt length in characters
  maxPromptTokens?: number;        // Maximum total prompt length in tokens (for documentation)
  warningThreshold?: number;       // Show warning at this percentage (default 0.8)

  // Guest Access
  guestAccess?: boolean;           // If true, model is available to guest users (non-authenticated)

  // Reference Image Support (KIE models)
  maxReferenceImages?: number;           // Max number of reference images (0 or undefined = not supported)
  referenceImageParam?: string;          // API parameter name for reference images (e.g. 'image_input', 'image_urls', 'input_urls')
  requiresReferenceImages?: boolean;     // If true, reference images are mandatory (e.g. edit/i2i models)

  /** Video-specific capability options (KIE video models only) */
  videoOptions?: KieVideoOptions;
}
