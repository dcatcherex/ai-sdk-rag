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
}
